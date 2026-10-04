# EasyChat 代码级设计文档

> 配套文档：[ROADMAP.md](./ROADMAP.md)（阶段路线图与已确认决策）
> 本文档把路线图中的每个任务拆解到**可直接动手写代码**的精度。
>
> **⚠️ 使用方式（教学导向）**
> 本文档**不是**待粘贴的代码清单。每个任务都给出了「现状 → 接口契约 → 你需要实现的部分 → 验收」，实现代码请由你自己写。
> 卡住时再看「实现提示」，写完后再做「代码审查清单」自检。

---

## 第 0 章 全局约定

动工前先统一三件事，否则后面每个任务都要重复决策。

### 0.1 消息类型注册表（唯一真相源）

现状：`com.easychat.enums.MessageTypeEnum` 已占用 `0 ~ 13`。

| 值 | 枚举名 | 是否落库 | 用途 |
| --- | --- | --- | --- |
| 0~13 | 现有 | 视类型而定 | 保持不变 |
| **14** | `ACK` | **否** | 消息送达确认（客户端 → 服务端 → 转发给发送方） |
| **15** | `REVOKE` | **否**（只更新原消息行） | 消息撤回通知 |

**设计决策：撤回不新增消息行**，而是更新原消息的 `revoke_time` / `revoke_user_id`，前端把该气泡重绘为"你撤回了一条消息"。理由：

- 避免同一逻辑消息产生两行，会话列表的 `lastMessage` 不必特殊处理
- 与 `V2__reliability.sql` 中已加的 `revoke_time` 字段一致

> **需要你决策**：`ACK` / `REVOKE` 属于「控制帧」，是否应该放进 `MessageTypeEnum`（和聊天消息混在一起），还是单独建 `WsControlTypeEnum`？
> 前者改动小、与现有协议一致；后者语义更清晰但要动 WS 分发逻辑。建议先按前者实现，在文档里记一笔技术债。

### 0.2 本地表迁移机制

前端 SQLite 的建表入口在 [Tables.js](file:///c:/Users/Administrator/easy-chat/src/main/db/Tables.js)，已有三个数组：

| 数组 | 语义 | 使用场景 |
| --- | --- | --- |
| `add_tables` | `create table if not exists ...` | **新增表**可直接追加，老用户重启动时也会建 |
| `alter_tables` | `{table_name, field, alter_sql}` | **给已有表加列**必须走这里（`add_tables` 对已存在的表不生效） |
| `add_index` | `create index if not exists ...` | 新增索引 |

**关键坑**：`chat_message` 已存在的老库，往 `add_tables` 里改 `CREATE TABLE` 语句**不会生效**。加列必须同时：

1. 修改 `add_tables` 里的建表语句（保证新装用户结构正确）
2. 往 `alter_tables` 里追加一条 `alter_sql`（保证老用户能升级）

回看 [Tables.js#L43-L51](file:///c:/Users/Administrator/easy-chat/src/main/db/Tables.js#L43-L51)，`alter_tables` 目前是个空注释模板 —— 你实现的第一个迁移就会填在这里。

### 0.3 本地 `chat_message` 表的去重能力（重要发现）

```sql
primary key(user_id, message_id)
```

主键是 **(user_id, message_id) 复合主键**。这意味着：

- 同一用户重复写入同一 `messageId` 会**主键冲突报错**，而不是静默重复
- 所以 M1-R4 的"去重"改造**不是加约束，而是把插入改成 `INSERT OR IGNORE`**，让重复写变成幂等操作
- 注意：`message_id` 目前**允许为 NULL 且默认 NULL**（[Tables.js#L4](file:///c:/Users/Administrator/easy-chat/src/main/db/Tables.js#L4)），SQLite 中 NULL 不参与主键唯一性判定 —— 这是"发送中"消息（还没有服务端 ID）能存进去的原因，但也会导致多条 NULL 记录共存

### 0.4 IPC 通道命名规范

现有通道分两类（见 [ipc.js](file:///c:/Users/Administrator/easy-chat/src/main/ipc.js)）：

- **渲染 → 主进程**：动词开头，如 `loadChatMessage`、`addLocalMessage`、`delChatSession`
- **主进程 → 渲染**：`xxx + Callback` 或 `receiveMessage`

新增通道请沿用该规范，并在本文档对应任务中登记。

---

## 第 1 章 M0-1 接入 Swagger / Knife4j

**学习目标**：理解 OpenAPI 规范与 Spring Boot 3 的集成方式，掌握"文档即契约"的前后端协作模式。

### 现状
- `pom.xml` 无任何 API 文档依赖
- 6 个 Controller 无注解
- **鉴权采用 AOP + 自定义注解（白名单模式）**，没有 Spring MVC 拦截器 —— 详见下方「改造设计」第 3 点的纠正说明

### 改造设计

**1. 依赖（Spring Boot 3.2 必须用 jakarta 版本）**

```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.3.0</version>
</dependency>
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
    <version>4.4.0</version>
</dependency>
```

**2. 新增配置类** `com.easychat.config.OpenApiConfig`，用 `@Bean OpenAPI` 定义分组与 JWT/token 的 header 参数。

**3. 鉴权无需放行 —— 但原因和直觉相反**（本节为**纠正说明**，早期版本曾误判为拦截器）

本项目**没有 Spring MVC 拦截器**。鉴权由 AOP + 自定义注解实现：

| 角色 | 文件 | 关键代码 |
| --- | --- | --- |
| 注解 | [GlobalInterceptor.java](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/annotation/GlobalInterceptor.java#L8-L13) | `@Target(METHOD)`，含 `checkLogin()` 默认 `true`、`checkAdmin()` 默认 `false` |
| 切面 | [GlobalOperationAspect.java](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/aspect/GlobalOperationAspect.java#L33-L34) | `@Before("@annotation(com.easychat.annotation.GlobalInterceptor)")` |

这是**白名单模式**：切点表达式是 `@annotation(...)`，意味着**只有被 `@GlobalInterceptor` 标注的方法才会被切中**。`/doc.html`、`/v3/api-docs` 不是你的 Controller 方法，永远不会命中切面 —— 因此**不需要放行任何路径，也不需要写 `excludePathPatterns`**。

> **由此引出一条必须刻进肌肉记忆的安全结论**
>
> 白名单模式下，**新增接口时漏加 `@GlobalInterceptor` = 接口公开裸奔**，且不会有任何报错提示。
> 本计划 M2 新增的 `/chat/revokeMessage`、`/chat/deleteMessage`、`/chat/forwardMessage`、`/chat/searchMessage` **都必须加上该注解**；管理端接口则用 `@GlobalInterceptor(checkAdmin = true)`。
>
> 验证方法：写完后全局搜索 `@PostMapping`，逐个确认下方都有 `@GlobalInterceptor`。

**4. 给 Controller 补注解**：`@Tag` 标类，`@Operation` 标方法，`@Parameter` 标参数。

### 你需要实现的部分
- [ ] `pom.xml` 加依赖
- [ ] `OpenApiConfig` 配置类
- [ ] 至少给 `AccountController` + `ChatController` 补全注解
- [ ] **（可选进阶）** 为 `@GlobalInterceptor` 增加 `@Operation` 级别的安全说明，让文档自动标注哪些接口需要 token

### 验收
启动后端 → 浏览器打开 `http://localhost:5050/api/doc.html` → 能看到分组的接口 → 直接在页面上调通 `/account/login`。

> 注意 URL 里的 `/api` 来自 `server.servlet.context-path=/api`（[application.properties#L6](file:///c:/Users/Administrator/easy-chat-java/src/main/resources/application.properties#L6)），少了它页面打不开。

### 实现提示（含一个本项目特有的坑）

**坑：`spring.web.resources.add-mappings=false`**

`application.properties` 第 18 行有这一句，它关闭了 Spring Boot 的**默认静态资源映射**。

而 knife4j 的 `/doc.html` 恰恰是个**静态资源** —— 它位于 knife4j jar 内的 `META-INF/resources/doc.html`。更关键的是，knife4j 4.5.0 **不会自己注册资源处理器**：

用 `javap` 查看 `Knife4jAutoConfiguration` 可证实，它只提供 Customizer、`CorsFilter` 和两个 SecurityFilter，**没有实现 `WebMvcConfigurer`**，一个资源处理器都没注册。

两者相加 → `/doc.html` 找不到处理器 → `NoHandlerFoundException`。

**两种修法：**

| 方案 | 做法 | 代价 |
| --- | --- | --- |
| A 全局放开 | 删掉该行（或改 `true`） | 所有未知路径会落到资源处理器，`NoHandlerFoundException` 不再抛出，**全局 404 日志行为改变** |
| **B 精准放开（推荐）** | 保持 `false`，在 `OpenApiConfig` 上实现 `WebMvcConfigurer`，只映射文档所需路径 | 多写 5 行代码 |

方案 B 的关键代码：

```java
@Configuration
public class OpenApiConfig implements WebMvcConfigurer {

    /**
     * 本项目关闭了默认静态资源映射（spring.web.resources.add-mappings=false），
     * 而 knife4j 的 doc.html 属于静态资源、其自动配置又不注册资源处理器，
     * 故此处精准放开文档所需路径，避免全局放开影响既有 404 语义。
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/doc.html")
                .addResourceLocations("classpath:/META-INF/resources/");
        registry.addResourceHandler("/webjars/**")
                .addResourceLocations("classpath:/META-INF/resources/webjars/");
    }
}
```

> **原理要点**：`spring.web.resources.add-mappings=false` 只关掉 **Spring Boot 自动配置**的资源映射；用户自定义的 `WebMvcConfigurer.addResourceHandlers` **不受影响**，仍会生效。这就是方案 B 能成立的原因。

> `/webjars/**` 必须一起映射：`doc.html` 内部用**相对路径**引用 `webjars/css/...`、`webjars/js/...`，浏览器会解析成 `/api/webjars/...`。

> `/v3/api-docs` 是普通的 `@RestController`（springdoc 提供），**不是静态资源**，不受该配置影响。

**排查路径（本次实际走过的）：**

1. 查 `pom.xml` → 依赖已加 ✅
2. 查 `.m2` 仓库 → `knife4j-openapi3-ui-4.5.0.jar` 已下载 ✅
3. 查 jar 内容 → `META-INF/resources/doc.html` 确实在里面 ✅
4. 查 `application.properties` → 发现 `spring.web.resources.add-mappings=false` ❌ **真凶**
5. `javap` 查自动配置类 → 确认 knife4j 不注册资源处理器，闭环

### 进阶思考（做完后回答自己）
1. 白名单模式 vs 拦截器黑名单模式，各自的失效场景是什么？
2. Knife4j 页面在生产环境应该开放吗？如果不该，有哪几种关闭方式（配置开关 / Profile / 网关层）？
3. 文档里暴露了 `/admin/**` 的接口签名，这算信息泄露吗？

### 参考示范（关键片段）

> 只给**关键片段**，不是完整补丁。请自己决定放在哪、怎么组织。

**① `pom.xml` —— properties 区新增版本号**

```xml
<springdoc.version>2.3.0</springdoc.version>
<knife4j.version>4.5.0</knife4j.version>
```

**② `pom.xml` —— dependencies 区新增依赖**

```xml
<!-- springdoc：扫描 Controller → 生成 OpenAPI 3 规范的 JSON（/v3/api-docs） -->
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>${springdoc.version}</version>
</dependency>

<!-- knife4j：读取上述 JSON → 渲染成可调试页面（/doc.html） -->
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
    <version>${knife4j.version}</version>
</dependency>
```

为什么要显式声明 springdoc？knife4j 本身会**传递引入** springdoc，但传递版本不由你控制。Maven 遵循「最近优先」——显式声明的版本会覆盖传递依赖，从而**把版本钉死**，避免哪天升了个库导致 springdoc 悄悄变版本、文档静默失效。

**③ `com.easychat.config.OpenApiConfig`（新建包 + 新建类）**

```java
package com.easychat.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 文档配置。
 * 扫描范围由 springdoc 自动推导（主类所在包及其子包），此处无需指定。
 */
@Configuration
public class OpenApiConfig {

    /** 安全方案名，需与 addSecuritySchemes 的 key 保持一致 */
    private static final String SECURITY_SCHEME = "token";

    /**
     * 构建全局 OpenAPI 元信息。
     * 声明「请求头传 token」的安全方案，Knife4j 页面据此显示 Authorize 输入框，
     * 便于联调需要登录的接口。
     */
    @Bean
    public OpenAPI easyChatOpenApi() {
        SecurityScheme tokenScheme = new SecurityScheme()
                .type(SecurityScheme.Type.APIKEY)
                .in(SecurityScheme.In.HEADER)
                .name("token");  // 与 GlobalOperationAspect 第 56 行的 request.getHeader("token") 对应

        return new OpenAPI()
                .info(new Info()
                        .title("EasyChat API")
                        .version("1.0.0")
                        .description("EasyChat 前后端接口文档"))
                .components(new Components().addSecuritySchemes(SECURITY_SCHEME, tokenScheme))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME));
    }
}
```

**④ `application.properties` —— 开启 Knife4j 增强 UI**

```properties
# Knife4j 增强 UI 开关；生产环境可用环境变量 KNIFE4J_ENABLE=false 关闭
knife4j.enable=${KNIFE4J_ENABLE:true}
```

> 如果 `/doc.html` 返回 404，**第一个要查的就是这个开关**（knife4j 4.x 不会默认开启增强 UI）。

**⑤ 给 `AccountController` 补注解（节选示范）**

```java
@Tag(name = "账号模块", description = "验证码、注册、登录、系统设置")
@RestController("accountController")
@RequestMapping("/account")
@Validated
public class AccountController extends ABaseController {

    @Operation(summary = "获取图片验证码", description = "返回 base64 图片与 checkCodeKey，登录/注册时需回传")
    @RequestMapping("/checkCode")
    public ResponseVO checkCode() { /* 原实现不动 */ }

    @Operation(summary = "用户登录", description = "校验图片验证码后返回用户信息与 token")
    @RequestMapping("/login")
    public ResponseVO login(
            @Parameter(description = "验证码标识") @NotEmpty String checkCodeKey,
            @Parameter(description = "邮箱") @NotEmpty @Email String email,
            @Parameter(description = "密码") @NotEmpty String password,
            @Parameter(description = "用户输入的验证码") @NotEmpty String checkCode) { /* 原实现不动 */ }
}
```

**⑥ 顺带一提（不属本任务，但值得记下）**

你的 Controller 全部用 `@RequestMapping("/xxx")` 而**没有限定 HTTP 方法**，这意味着 GET / POST / PUT / DELETE 都能打到同一个接口。这在 REST 语义上是模糊的，也会让文档无法表达"这个接口只接受 POST"。

现在**不要改**（会牵动前端调用方式），但请把它记进你的技术债清单 —— M3 的接口治理阶段会处理。

---

## 第 2 章 M0-2 配置外置

**学习目标**：理解十二要素应用（12-Factor App）的配置原则，学会用 Spring 的占位符做环境隔离。

### 现状
`application.properties` 中存在**明文敏感项与绝对路径**（数据库账号密码、`project.folder` 指向 `C:/Administrator/...`、管理端账号）。这会导致：
- 代码库泄露即密码泄露
- 换机器启动就因路径不存在而失败

### 改造设计

改造模式（Spring 占位符 + 默认值）：

```properties
# 改造前
spring.datasource.password=xxxx
project.folder=C:/Administrator/easychat-file

# 改造后
spring.datasource.password=${EASYCHAT_DB_PASSWORD:}
project.folder=${EASYCHAT_PROJECT_FOLDER:${user.home}/easychat-file}
```

要点：
- `${VAR:default}` 语法：环境变量优先，缺失时用默认值
- `${user.home}` 是 Spring 内置的系统属性，能天然适配不同操作系统
- 新增 `application-dev.properties` 放本地开发值，并加入 `.gitignore`

### 你需要实现的部分
- [ ] 列出所有需外置的配置项，形成一张「配置项 → 环境变量名 → 默认值」映射表
- [ ] 改写 `application.properties`
- [ ] 新建 `application-dev.properties` 并加入 `.gitignore`
- [ ] 本地用环境变量方式启动验证一次

### 验收
- 不设置任何环境变量时，后端能用默认值在**任意用户目录**启动
- 设置了错误的密码时，启动报错信息清晰可定位

### 代码审查清单
- 是否还有 `.properties` / `.yml` 里残留明文密码？
- 日志里是否会打印数据源连接串（含密码）？检查 Hikari 的日志级别。

---

## 第 3 章 M0-3 数据库迁移（Flyway）

**学习目标**：理解为什么"数据库结构"是唯一没有版本控制的一等公民，掌握 Flyway 的**版本账本**与**校验和**机制，并完成本项目从"裸 SQL 文件"到"受管迁移"的切换。

### 现状（实证，非推测）

对本地 MySQL 8.0.43 实测（`information_schema` 查询）：

- 库 `easychat` 存在，9 张表：`app_updation` / `chat_message` / `chat_session` / `chat_session_user` / `group_info` / `user_contact` / `user_contact_apply` / `user_info` / `user_info_beauty`
- `chat_message` 仍为原始 13 列，**V2 从未执行**
- 全仓库**零建表 DDL**（`grep -r "CREATE TABLE"` 仅命中 V2 脚本本身）
- `pom.xml` 无 Flyway，也无 Liquibase

**核心问题：假契约。** `docs/sql/V2__reliability.sql` 采用了 Flyway 命名规范（`V2__` 前缀），但项目并没有 Flyway —— 这个文件永远不会被执行，同时又会让人误以为"它已经被自动保证了"。形式上的规范配上不存在的执行机制，比"没有迁移文件"更危险。

**ID 类字段的既有约定（实测）** —— 新增字段必须对齐：

| 字段 | 全库统一类型 |
| --- | --- |
| `user_id` | `varchar(12)` |
| `contact_id` | `varchar(12)` |
| `session_id` | `varchar(32)` |

### 改造设计

**1. 依赖**（Boot 3.2.0 的 `spring-boot-dependencies` 已管理 flyway `9.22.3`，故**不写版本号**）

```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-mysql</artifactId>
</dependency>
```

为什么必须单独引 `flyway-mysql`：Flyway 8.2 起把各数据库方言拆成独立模块，`flyway-core` **不再内置** MySQL 支持。可自行验证 —— Boot 3.2.0 的 `spring-boot-dependencies-3.2.0.pom` 第 706–724 行把 `flyway-core` 与 `flyway-mysql` **并列**声明，说明这是预期用法。

**2. 配置**（写入入库的 `application.properties`）

```properties
spring.flyway.locations=classpath:db/migration
spring.flyway.baseline-on-migrate=true
spring.flyway.baseline-version=1
spring.flyway.validate-on-migrate=true
```

**3. baseline 的语义（本章最关键，已查证官方文档）**

Flyway 官方对 `baselineOnMigrate` 的定义原文：

> "Whether to automatically call baseline when migrate is executed against a non-empty schema with no schema history table. This schema will then be baselined with the `baselineVersion` before executing the migrations. **Only migrations above `baselineVersion` will then be applied.**"

于是同一份仓库能同时服务两种现状：

| 场景 | Flyway 行为 |
| --- | --- |
| **已有库**（你的现状：9 张表、无 history 表） | 建 `flyway_schema_history`，写入一行 baseline（version=1），**跳过 V1**，只执行 V2 |
| **全新空库**（新人 clone） | 不触发 baseline，按序执行 V1 → V2 |

一份 `V1__baseline.sql` 同时满足两条路径 —— 这就是把 `baseline-version` 设为 `1` 的原因。

> **风险提示（官方原文）**：`baselineOnMigrate` 会**移除"防止误连库"的安全网**。一旦数据源 URL 配错连到别的库，Flyway 不再因"库非空"拒绝，而是把它当作 baseline 直接往上迁移。生产环境更稳妥的做法是用手工 `baseline` 命令而非开关。

**4. `V1__baseline.sql` 的生成命令**

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" `
  -uroot -p --no-data --skip-add-drop-table --skip-comments `
  --set-gtid-purged=OFF easychat > src/main/resources/db/migration/V1__baseline.sql
```

每个参数的理由（都对应一个具体后果，不是"惯例")：

| 参数 | 为什么 |
| --- | --- |
| `--no-data` | baseline 只描述**结构**。历史业务数据不进版本库：体积大、含隐私、且对新环境毫无意义 |
| `--skip-add-drop-table` | 默认输出会在每张表前加 `DROP TABLE IF EXISTS`。baseline 里留 DROP 是隐患 —— 万一被误用到有数据的库上就是删表 |
| `--skip-comments` | 默认注释含 **dump 时间戳与主机名** → 每次导出内容都不同 → Flyway 的 checksum 每次都变。这条是"让文件可复现"的关键 |
| `--set-gtid-purged=OFF` | 避免写入 GTID 相关语句（跨环境导入会报错） |
| **不加** `--databases` | 否则会生成 `CREATE DATABASE` / `USE`。目标 schema 应由数据源 URL 决定，脚本里不该硬编码库名 |

**5. 修正 V2 的三处字段宽度与一处 DDL 算法**，详见下方「已知缺陷」。

### 你需要实现的部分

- [ ] `pom.xml` 加 `flyway-core` + `flyway-mysql`（**不写版本号**，交给 parent 管理）
- [ ] `application.properties` 加上述 4 条 flyway 配置
- [ ] 用 `mysqldump` 生成 `src/main/resources/db/migration/V1__baseline.sql`
- [ ] 修正 `V2__reliability.sql`：3 处字段宽度 + 1 处 `ALGORITHM/LOCK`，然后**移动**到 `src/main/resources/db/migration/`
- [ ] **删除** `docs/sql/V2__reliability.sql` —— 同一份内容存在两处就是下一个"假契约"
- [ ] 首次启动验证 + 二次启动幂等验证

### 验收

1. 首次启动日志出现 Flyway 执行 `2 - reliability`，无异常
2. `SELECT * FROM flyway_schema_history;` 有两行：`1 / BASELINE` 与 `2 / SQL`
3. `SHOW COLUMNS FROM chat_message` 含 5 个新列；`SHOW TABLES` 含 `chat_message_delete`
4. **二次启动**日志出现 `Schema ... is up to date. No migration necessary.`，且 history 表行数不变 —— 这是 Flyway 价值的直接演示，务必做
5. **（进阶）** 建空库 `easychat_test`，以 `-DEASYCHAT_DB_URL=...easychat_test` 启动，确认 V1 + V2 均执行、表结构完整 —— 这是**唯一**能验证 `V1__baseline.sql` 质量的方式

### 已知缺陷（本脚本的自我更正）

V2 由本次教学编写，复查时发现两处问题，需在本次一并修正。

**① 字段宽度与既有约定不一致（静默漂移）**

| 位置 | 原文 | 应为 |
| --- | --- | --- |
| `chat_message.revoke_user_id` | `VARCHAR(32)` | `VARCHAR(12)` |
| `chat_message_delete.user_id` | `VARCHAR(32)` | `VARCHAR(12)` |
| `chat_message_delete.session_id` | `VARCHAR(64)` | `VARCHAR(32)` |

MySQL 不会报错（长一点永远装得下），所以这是**静默的类型漂移**。后果有两个：长度不一致的 varchar 在 JOIN 或索引比较时触发**隐式类型转换，导致索引失效**；同名字段出现两种长度，会让后续维护者无法判断哪个是对的。

根因：写脚本时**没有先去库里读现状，凭印象就写了**。

**② `ALGORITHM=INPLACE, LOCK=NONE` 把 INSTANT 降级了**

原意是"避免锁表"，但 MySQL 8.0.12+ 的 `ADD COLUMN` 默认走 **INSTANT** —— 只改元数据，秒级完成，完全不碰数据文件。显式指定 `ALGORITHM=INPLACE` 反而把执行路径**降级**为需要重建表的老路径。MySQL 8.0.29+ 支持一条 ALTER 内多列同时 INSTANT，本项目 8.0.43 满足条件。

**正确做法：不写 `ALGORITHM` / `LOCK`，让优化器自己选 INSTANT。**

> 注意 `CREATE INDEX` 没有 INSTANT 一说，索引只有 INPLACE 一条路，写不写无差别。

**教训**：显式指定"看起来更保守"的参数，不等于结果更好 —— DDL 的执行算法必须按引擎版本查证，不能凭"稳妥起见"。

### 常见坑

- **唯一索引 + NULL 的交互**：`uk_client_msg_id` 建在**可空列**上。InnoDB 的唯一索引中 **NULL 不参与唯一性判定**，因此历史行（`client_message_id` 全为 NULL）可以共存，多条"发送中"的消息也不冲突 —— 这恰好是 M1-R3 需要的语义。反过来看：若将来要把该列改为 `NOT NULL`，**必须先回填历史数据**，否则默认值 `''` 会让多行直接撞唯一索引。
- **DDL 没有事务**：MySQL 的 DDL 会隐式提交，多条 ALTER 语句中途失败会留下"半执行"状态。所以 V2 把 5 个 `ADD COLUMN` **合并为一条**（MySQL 8 是原子 DDL，单条语句要么全成、要么全败）。
- **脚本不可重复执行**：MySQL 8 的 `ADD COLUMN` **不支持** `IF NOT EXISTS`（那是 MariaDB 的语法）。重复执行直接报 `Duplicate column name` —— 这正是必须有账本的原因。
- **Maven 资源过滤**：`src/main/resources` 下 Spring Boot parent 只为 `application*.properties` / `*.yml` 开启 filtering，`.sql` 不会被改写，checksum 稳定。若自行开启全局 filtering，迁移文件会因变量替换而被破坏。

### 进阶思考（做完后回答自己）

1. 如果团队里有人"顺手改了"一个已经执行过的 `V2__reliability.sql`，Flyway 会怎么处理？为什么它选择直接失败而不是自动修复？
2. 为什么迁移脚本**不应该**放在应用启动时用 `spring.sql.init` 或 JPA 的 `ddl-auto` 去跑？多实例同时启动会怎样？
3. `baseline-version=1` 时，`V1__baseline.sql` 在已有库上被"跳过"而不是"执行"，那怎么保证它和真实库结构一致？如果它写错了，谁能发现？

---

## 第 4 章 M1-R1 客户端幂等 ID

**学习目标**：掌握"幂等键（Idempotency Key）"这一分布式系统基础模式，理解为什么自增主键不能做幂等。

**为什么必须做**：当前 `messageId` 由数据库 `SELECT LAST_INSERT_ID()` 生成（[ChatMessageMapper.xml#L142-L145](file:///c:/Users/Administrator/easy-chat-java/src/main/resources/mapper/ChatMessageMapper.xml#L142-L145)），**客户端在发送前根本不知道 ID**。一旦 HTTP 超时重发，服务端就会插入第二行 —— 这是重复消息的根因。

### 现状（精确）

| 层 | 位置 | 现状 |
| --- | --- | --- |
| PO | [ChatMessage.java#L11-L38](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/entity/po/ChatMessage.java#L11-L38) | 无 `clientMessageId` 字段 |
| DTO | [MessageSendDto.java#L11-L42](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/entity/dto/MessageSendDto.java#L11-L42) | 无 `clientMessageId` 字段 |
| Mapper XML | [ChatMessageMapper.xml#L142-L229](file:///c:/Users/Administrator/easy-chat-java/src/main/resources/mapper/ChatMessageMapper.xml#L142-L229) | `insert` 用 `<trim>` 动态拼列，新增字段需同步加两处 `<if>` |
| Service | [ChatMessageServiceImpl.java#L128-L200](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/service/impl/ChatMessageServiceImpl.java#L128-L200) | 无查重，直接 insert |
| DB | `V2__reliability.sql` | 已含 `client_message_id` + `uk_client_msg_id` 唯一索引 |

### 改造设计

**契约（必须先在文档里定死，再写代码）**

```
POST /api/chat/sendMessage
Request  : { clientMessageId: "uuid-v4", contactId, messageType, messageContent, ... }
Response : { status: "ok", data: <MessageSendDto> }   // 含服务端生成的 messageId
```

**幂等语义（三种情况要想清楚）**

| 情况 | 期望行为 |
| --- | --- |
| 首次请求 | 正常插入，返回新消息 |
| 重复请求（同 clientMessageId，已插入） | **不插入**，返回已存在的那条消息 |
| `clientMessageId` 为空 | 退化为非幂等（兼容老客户端 / 机器人消息） |

**关键点**：查重必须放在 `saveMessage` 的**最前面**（在联系人校验之前），否则重复请求可能因为其他校验失败而返回错误，幂等就不成立了。

### 你需要实现的部分
- [ ] `ChatMessage` 加 `clientMessageId` 字段 + getter/setter（**保留原有注释风格**）
- [ ] `MessageSendDto` 加 `clientMessageId` 字段
- [ ] `ChatMessageMapper.xml` 的 `insert` 中，在 `<trim>` 里加两处 `<if test="bean.clientMessageId != null">`
- [ ] `ChatMessageMapper` 接口加 `ChatMessage selectByClientMessageId(String clientMessageId)`
- [ ] `ChatMessageServiceImpl.saveMessage` 开头加查重分支
- [ ] 前端 `MessageSend.vue` 发送前生成 `clientMessageId`

### 前端要点
用 `crypto.randomUUID()` 生成 v4 UUID（Electron 的 Node 20 环境原生支持，无需引入 uuid 库）。

### 验收
1. 用 Postman 同一个 `clientMessageId` 连发 3 次 `/chat/sendMessage` → 数据库只有 1 行
2. 3 次响应里的 `messageId` **完全相同**
3. 不传 `clientMessageId` 时行为与改造前一致

### 常见坑
- **别用 `insert or update`**：并发下 `insertOrUpdate` 会更新已有行，把消息内容覆盖成第二次请求的内容
- 唯一索引是最后防线：即使代码有 bug，DB 层也会因 `uk_client_msg_id` 报 `DuplicateKeyException`。**要在 Service 捕获它并转成"查询后返回"**，而不是把异常抛给用户

### 参考示范（关键片段）

**Service：查重分支（放在 `saveMessage` 方法体第一行，早于联系人校验）**

```java
// 幂等查重：clientMessageId 非空且已存在，直接返回已有消息，不做任何写入 / 广播
if (!StringTools.isEmpty(chatMessage.getClientMessageId())) {
    ChatMessage existMessage = chatMessageMapper.selectByClientMessageId(chatMessage.getClientMessageId());
    if (existMessage != null) {
        logger.info("命中幂等键，返回已存在消息 clientMessageId={}", chatMessage.getClientMessageId());
        // 注意：这里只 copy 返回，不能重发 WS、不能更新 ChatSession 的 lastMessage/lastReceiveTime
        return CopyTools.copy(existMessage, MessageSendDto.class);
    }
}
```

**Mapper 接口**

```java
// 根据 clientMessageId 查询（幂等查重）
T selectByClientMessageId(@Param("clientMessageId") String clientMessageId);
```

**Mapper XML：三处改动**

`base_result_map` 补一行（否则字段查得出来但映射不到 PO 属性）：

```xml
<!-- 客户端消息ID（幂等键） -->
<result column="client_message_id" property="clientMessageId"/>
```

`base_column_list` 补一列：

```xml
...,file_type,status,client_message_id
```

新增查询：

```xml
<!-- 根据 clientMessageId 查询（幂等查重） -->
<select id="selectByClientMessageId" resultMap="base_result_map">
    SELECT <include refid="base_column_list"/>
    FROM chat_message
    WHERE client_message_id = #{clientMessageId}
</select>
```

`insert` 的 `<trim>` 里加**两处** `<if>`（列名一处、值一处；少一处会导致列与值数量不匹配）：

```xml
<if test="bean.clientMessageId != null">
    client_message_id, 
</if>
```

```xml
<if test="bean.clientMessageId != null">
    #{bean.clientMessageId}, 
</if>
```

**Service：唯一索引兜底（`insert` 处）**

```java
try {
    chatMessageMapper.insert(chatMessage);
} catch (DuplicateKeyException e) {
    // 并发窗口下查重可能漏判，靠 uk_client_msg_id 兜底；此处转成"查询后返回"
    ChatMessage existMessage = chatMessageMapper.selectByClientMessageId(chatMessage.getClientMessageId());
    if (existMessage != null) {
        return CopyTools.copy(existMessage, MessageSendDto.class);
    }
    throw e;   // 查不到说明不是幂等冲突，严禁吞掉
}
```

（import `org.springframework.dao.DuplicateKeyException`）

**前端：幂等键挂在"一条逻辑消息"上，而不是"一次 HTTP 调用"里**

```js
// 与 messageObj.sessionId / sendUserId 同处赋值；M1-R3 待发队列重发时会复用同一个 id
messageObj.clientMessageId = crypto.randomUUID()
```

**取舍说明**

- **为什么"客户端生成"而不是"服务端生成后返回"**：服务端生成的 ID 在第一次请求完成前不存在；若第一次请求超时丢失，客户端拿不到 ID，重试时无法自证同一操作。幂等键的前提是"发起方先行持有"。
- **为什么"查重 + 唯一索引"要同时存在**：只靠查重，并发下有窗口（两请求同时 SELECT 都未命中）；只靠唯一索引，冲突会以异常形式返回给用户，体验差且语义不清。乐观查重负责"常规路径友好返回"，唯一约束负责"并发兜底正确性"。
- **为什么不把 clientMessageId 当主键**：消息表 JOIN 与增量拉取（M1-R4）都以 `message_id`（有序自增）为游标，UUID 无序且长度大，作主键会破坏聚簇索引的插入局部性并拖慢范围查询。幂等键只承担"唯一性判定"这一个职责。

---

## 第 5 章 M1-R2 下行 ACK

**学习目标**：理解 IM 中「消息状态机」的设计，区分"已入库 / 已送达 / 已读"三个语义。

### 现状（精确）

**服务端的"静默丢弃"**：`ChannelContextUtils.sendMsg` 在目标 channel 为空时直接 `return`。也就是说**对端不在线，消息就丢了**，只能等下次登录靠 `addContext` 补偿。

**客户端的 switch 分支**（[wsClient.js#L81-L155](file:///c:/Users/Administrator/easy-chat/src/main/wsClient.js#L81-L155)）：

| case | 含义 | 行为 |
| --- | --- | --- |
| 0 | WS 连接成功（INIT） | 批量写会话 + 消息 + 刷申请未读数 |
| 1/2/3/5/8/9/11/12 | 聊天/媒体/群事件 | 更新会话 + `saveMessage` + 转发渲染进程 |
| 4 | 好友申请 | 未读数 +1 |
| 6 | 文件上传完成 | 按 `messageId` 更新 status |
| 7 | 强制下线 | `closeWs()` |
| 10 | 改群昵称 | 更新群名 |

**注意 L113-L115**：`if (message.sendUserId == store.getUserId() && message.contactType == 1) break` —— 自己发的**群消息**不回显，自己发的**单聊消息**会回显（靠服务端推送回来渲染）。

### 改造设计

**状态机（先定语义，再写代码）**

```
SENDING(0) ──HTTP成功──> SENDED(1) ──收到ACK──> DELIVERED(2)
```

现有 [MessageStatusEnum](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/enums/MessageStatusEnum.java) 只有 `SENDING(0)` / `SENDED(1)`，**需要新增 `DELIVERED(2, "已送达")`**。

> 已确认决策：**已读仅单聊实现**。所以 `READ(3)` 这条路径只对 `contactType == 0` 生效。

**ACK 协议（控制帧，不落库）**

```
接收方 → 服务端 : { "messageType": 14, "clientMessageId": "xxx", "messageId": 123 }
服务端 → 发送方 : { "messageType": 14, "clientMessageId": "xxx", "messageId": 123, "status": 2 }
```

**ACK 从哪里发出？** 有两个位置，需要你判断哪个更合适：
- (a) 主进程 `wsClient.js` 收到 case 2/5 后自动回 ACK
- (b) 渲染进程真正渲染出消息后再回 ACK

(a) 实现简单，但"进程收到了但 UI 崩了"也会算送达；(b) 语义更准但要多一条 IPC 通道。**建议先做 (a)**，在文档记一笔。

**服务端如何处理**：现有 `HandlerWebSocket.channelRead` 收到文本帧时**只是刷新心跳**，并不解析内容。需要改造为：

```
收到文本帧
  ├─ 内容 == "heart beat"  → 刷新心跳（保持现状）
  └─ 否则 → 尝试 JSON.parse
        ├─ messageType == 14 → 交给 ACK 处理逻辑，return（不进聊天流程）
        └─ 解析失败 → 忽略并打日志
```

> **坑**：客户端心跳发的是**纯字符串 `"heart beat"`**（[wsClient.js#L59](file:///c:/Users/Administrator/easy-chat/src/main/wsClient.js#L59)），不是 JSON。直接 `JSON.parse` 会抛异常，必须先用字符串比较短路。

**ACK 存哪里**：Redis，key `im:msg:ack:{sendUserId}`，用 Hash 存 `clientMessageId → 送达时间`，TTL 7 天。
> 已确认决策：**不持久化**，Redis 重启丢失可接受（消息本体在 MySQL 不受影响）。

### 你需要实现的部分
- [ ] `MessageStatusEnum` 加 `DELIVERED(2, "已送达")`
- [ ] `MessageTypeEnum` 加 `ACK(14, ...)`
- [ ] `HandlerWebSocket.channelRead` 改造（含 `"heart beat"` 短路）
- [ ] 新增 `AckService` / 或在 `RedisComponent` 加 ACK 读写方法
- [ ] ACK 到达后，通过 `MessageHandler` 推给发送方
- [ ] `wsClient.js` case 2/5 分支内回发 ACK
- [ ] `wsClient.js` 新增 case 14 分支：更新本地消息 status=2
- [ ] `ChatMessageModel.updateMessage` 复用（已存在，见 [ChatMessageModel.js](file:///c:/Users/Administrator/easy-chat/src/main/db/ChatMessageModel.js)）

### 验收
1. A 发消息给在线的 B → A 的气泡从"发送中"变为"已送达"
2. B 离线时 A 发送 → 状态停在"已发送"，B 上线收到后 A 收到 ACK
3. 心跳仍正常（观察 30s 内连接不被服务端断开）

### 代码审查清单
- ACK 帧不走 `saveMessage`，因此**不会触发** `saveMessage` 里"仅允许 CHAT/MEDIA_CHAT"的类型校验（[ChatMessageServiceImpl.java#L161-L164](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/service/impl/ChatMessageServiceImpl.java#L161-L164)）—— 确认你的 ACK 处理**在进入聊天流程之前就 return 了**
- ACK 是否可能被恶意伪造（别人替你回 ACK）？是否需要校验 `messageId` 确实属于该用户？

### 参考示范（关键片段）

> 只给**关键片段**，不是完整补丁。本节的代码是在读完现状后写的，含**两处对上方"改造设计"的修正**（① 离线消息要回 ACK、② 状态差在 UI 上不可见），以及**一处主动偏离**（不建 Redis 台账，见 ⑧）。

**① 枚举**（`MessageStatusEnum` 加一行、`MessageTypeEnum` 加一行）

```java
// MessageStatusEnum
DELIVERED(2, "已送达");

// MessageTypeEnum
ACK(14, "", "消息送达确认");
```

**② `HandlerWebSocket.channelRead0` 改造**

```java
@Override
protected void channelRead0(ChannelHandlerContext ctx, TextWebSocketFrame msg) throws Exception {
    Channel channel = ctx.channel();
    Attribute<String> attribute = channel.attr(AttributeKey.valueOf(channel.id().toString()));
    String userId = attribute.get();
    String text = msg.text();

    // 任何一帧都说明连接活着，保持原有的"每帧刷新心跳"语义
    redisComponent.saveHeartBeat(userId);

    // 心跳是纯字符串，不是 JSON —— 必须字符串比较短路，否则每次心跳都抛解析异常
    if (Constants.WS_HEART_BEAT.equals(text)) {
        return;
    }
    try {
        MessageSendDto sendDto = JsonUtils.convertJson2Obj(text, MessageSendDto.class);
        if (sendDto != null && MessageTypeEnum.ACK.getType().equals(sendDto.getMessageType())) {
            // 控制帧：处理完立即返回，绝不进入聊天落库流程
            ackService.processAck(userId, sendDto.getMessageId(), sendDto.getClientMessageId());
        }
    } catch (Exception e) {
        // 非协议帧/坏帧：只记日志，不能影响连接（JsonUtils 解析失败会抛异常，不是返回 null）
        logger.warn("收到无法解析的WS帧, userId={}, text={}", userId, text, e);
    }
}
```

> `Constants.WS_HEART_BEAT` 目前不存在，需要在 `Constants` 里加 `public static final String WS_HEART_BEAT = "heart beat";`（客户端发的就是这个字面量，见 [wsClient.js#L59](file:///c:/Users/Administrator/easy-chat/src/main/wsClient.js#L59)）。

**③ `AckService.processAck`（新建 `com.easychat.service.AckService`）**

```java
/**
 * 处理接收方回传的送达确认。
 * @param ackUserId 回 ACK 的人（接收方）
 * @param messageId 被确认的消息ID
 * @param clientMessageId 客户端幂等ID（可空）
 */
public void processAck(String ackUserId, Long messageId, String clientMessageId) {
    if (messageId == null) {
        return;
    }
    ChatMessage message = chatMessageMapper.selectByMessageId(messageId);
    if (message == null) {
        return;
    }
    // 防伪造：不能给自己的消息回 ACK
    if (ackUserId.equals(message.getSendUserId())) {
        return;
    }
    // 单聊：接收方必须等于 contactId；群聊 contactId 是群ID，此处只做"非发送者"校验
    boolean isSingle = UserContactTypeEnum.USER.getType().equals(message.getContactType().intValue());
    if (isSingle && !ackUserId.equals(message.getContactId())) {
        return;
    }

    MessageSendDto ackDto = new MessageSendDto();
    ackDto.setMessageType(MessageTypeEnum.ACK.getType());
    ackDto.setMessageId(messageId);
    ackDto.setClientMessageId(clientMessageId);
    ackDto.setStatus(MessageStatusEnum.DELIVERED.getStatus());
    // 关键：sendMsg 会用 sendUserId 覆写 contactId 来做路由，所以必须把发送方填进这两个字段
    ackDto.setSendUserId(message.getSendUserId());
    ackDto.setContactId(message.getSendUserId());
    messageHandler.sendMessage(ackDto);
}
```

> 路由用的是 [ChannelContextUtils.sendMsg](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/websocket/ChannelContextUtils.java#L151-L173) 里那句 `messageSendDto.setContactId(messageSendDto.getSendUserId())` —— 所以 ACK 想推给发送方，就得把**发送方 userId 填进 `sendUserId`**。走 `MessageHandler` 发 Redis 主题而不是直接 `sendMsg`，是为了多节点部署时也能跨节点投递。

**④ `wsClient.js`：接收方回 ACK（这是修正 ①）**

```js
const sendAck = (message) => {
  if (!message || message.sendUserId === store.getUserId()) return
  if (message.messageType !== 2 && message.messageType !== 5) return
  if (ws == null || ws.readyState !== 1) return
  ws.send(
    JSON.stringify({
      messageType: 14,
      messageId: message.messageId,
      clientMessageId: message.clientMessageId
    })
  )
}
```

case 0（初始化批量）在 `saveMessageBatch` 之后补一段：

```js
// 离线消息是随 INIT 一起批量下发的，不走下面的 case 2/5，
// 如果只在 case 2/5 回 ACK，验收 2（B 上线后 A 收到 ACK）永远过不了
;(message.extendData.chatMessageList || []).forEach(sendAck)
```

case 2/5 分支在 `await saveMessage(message)` 之后加 `sendAck(message)`。

**⑤ `wsClient.js`：新增 case 14**

```js
case 14:
  await updateMessage({ status: message.status }, { messageId: message.messageId })
  sender.send('receiveMessage', message)
  break
```

**⑥ `Chat.vue` 的 `onReceiveMessage`：更新内存中的状态（否则气泡不刷新）**

```js
if (message.messageType == 14) {
  const localMessage = messageList.value.find((item) => item.messageId == message.messageId)
  if (localMessage != null) {
    localMessage.status = message.status // 2 = 已送达
  }
  return
}
```

**⑦ 状态可见化（修正 ②，可选但建议做）**

现状 [ChatMessage.vue](file:///c:/Users/Administrator/easy-chat/src/renderer/src/views/chat/ChatMessage.vue#L4) 只在 `status == 0` 时显示骨架屏，**status 1 和 2 在界面上完全一样**，所以"从已发送变成已送达"肉眼看不见。最小代价：给"我发的"气泡加一行小字。

```html
<!-- .message-content-my 内，Avatar 左侧 -->
<span
  v-if="data.messageType != 5"
  class="send-status"
>{{ data.status == 2 ? '已送达' : '已发送' }}</span>
```

> 不想动 UI 就把验收 1 改成"查本地 SQLite 的 `chat_message.status` 从 1 变 2"。

**⑧ 与设计的偏差说明（记录在此，避免以后翻旧账）**

原设计要求把 ACK 写进 Redis（`im:msg:ack:{sendUserId}` 的 Hash，TTL 7 天）。但在 M1-R2 范围内**没有任何代码会读这份台账** —— 真正消费它的是"发送方离线时补投"和 M1-R4 的增量补偿。现在写入等于死代码，重复 ACK 的去重也不需要它（前端重复把 status 置 2 天然幂等）。因此**本次不建 Redis 台账**，等 M1-R4 引入增量补偿时一并补上。

**⑨ 已知缺口：ACK 丢失无法纠正（2026-10-04 记录）**

当前实现中，"已送达"（`status=2`）完全由**一次** ACK 通知决定，而这条通知走的是 best-effort 路径。下列任一情况发生时，发送方的消息会**永久停在 `status=1`**，没有任何机制会纠正：

- 接收方收到消息后未发出 ACK（App 崩溃 / 连接中断窗口）
- 服务端转发 ACK 时发送方离线，`sendMsg` 发现 channel 为空直接丢弃
- 转发帧在途时连接断开

注意：WebSocket 底层是 TCP，丢的**不是比特而是时机**（参与方不在场）。因此不需要给 ACK 再造一层可靠传输，而应让状态**可重建**。

- 目标形态：**水位线对账** —— 服务端维护每个会话"对方已送达的最新位置"，发送方在重连 / 切回会话 / 定时拉取时，把 ≤ 水位的消息批量置 2。该方案幂等、抗丢失、天然去重。
- 与 ⑧ 的关联：被推迟的 Redis 台账正是"服务端水位线"的存储位置；补上它即可同时覆盖"发送方离线"这类丢失。
- 计划：M1-R2 先按 best-effort 实现，此处显式记录缺口；M1-R4 增量补偿时统一用"对账"思路补齐。
- **待决策**：把"已送达"定义为**软提示**（最终一致，秒级即可）还是**可靠回执**（需再加持久化与去重）。

**⑩ 已决策：采用"水位线对账"作为正式目标架构（2026-10-04）**

用户确认：**已送达 / 已读不做逐条精确回执，改用会话级水位线 + 对账**。这修正了本节前面"逐条 ACK 即最终方案"的临时定位。

核心设计（**一根尺子，两个刻度**）：`已送达` 与 `已读` 不是两套机制，而是同一条消息位置水位线上的两个阈值。

- **推进者**：接收方客户端。渲染出一条消息 → 推进"送达水位"；打开该会话 → 推进"已读水位"。
- **存储**：服务端按 `(会话, 接收方)` 保存两个位置值。⑧ 中被推迟的 Redis 台账，正是这两个位置值的存放处。
- **消费**：发送方把本地每条消息的位置与该水位比较，得出该消息的状态。
- **单调性**：水位**只增不减**；发送方状态推进也**只增不减**（幂等），重复推进不会回退。

与各课的关系：

- **M1-R2（本课）**：逐条 ACK **保留**，重新定位为"水位线的逐条推进版 / 快路径"，用于亲手暴露"会丢"这个缺口。唯一新增约束：状态推进写成**只增不减的幂等操作**，供后续水位线批量置位复用。
- **M1-R3**：**不受影响**。它解决"消息还没发出去怎么重试"（发送侧，复用 `clientMessageId`），与水位线（送达/已读）正交。
- **M1-R4**：由"增量补偿"升级为**"水位线对账"**，承载送达 / 已读两个阈值。整体是"快路径（逐条 ACK，及时但可能丢）+ 权威路径（水位线对账，慢但一定补齐）"的经典结构。

---

## 第 6 章 M1-R3 本地待发队列 + 重试

**学习目标**：掌握"本地优先（local-first）"写入模式与指数退避重试。

### 现状
[ipc.js#L106-L122](file:///c:/Users/Administrator/easy-chat/src/main/ipc.js#L106-L122) 已有 `addLocalMessage` 通道：`saveMessage` → 存文件 → 更新会话。但它是**上传文件分支**，不是通用发送队列。

`MessageSend.vue` 的发送是**直接 HTTP**，失败仅弹框，消息不留痕。

### 改造设计

**新增本地表**

```sql
create table if not exists pending_message(
  client_message_id varchar not null,
  user_id varchar not null,
  contact_id varchar,
  payload text,          -- 序列化后的消息体
  retry_count integer default 0,
  next_retry_at bigint,  -- 下次重试时间戳
  status integer default 0,  -- 0等待 1成功 2失败
  create_time bigint,
  primary key(client_message_id)
);
```

**流程（先想清楚顺序，再写代码）**

```
用户点发送
  ├─ 1. 生成 clientMessageId
  ├─ 2. 写 pending_message（status=0）           ← 本地先落盘
  ├─ 3. UI 立即渲染"发送中"气泡
  ├─ 4. 发 HTTP
  │     ├─ 成功 → pending 置 1，本地消息补上服务端 messageId、status=1
  │     └─ 失败 → retry_count++，next_retry_at = now + backoff(n)
  └─ 5. 定时器扫描 next_retry_at <= now 的记录重发
```

**退避序列**：1s / 2s / 4s / 8s / 16s，最多 5 次，之后置 `status=2`，UI 显示"发送失败 + 重试按钮"。

**App 重启恢复**：启动时扫描 `status=0 或 2` 的记录，重新入队。

### 你需要实现的部分
- [ ] `Tables.js` 的 `add_tables` 追加建表语句
- [ ] 新建 `src/main/db/PendingMessageModel.js`，实现 `add` / `updateStatus` / `selectRetryList` / `delete`
- [ ] 新增 IPC 通道：`sendMessage`（渲染→主进程，走队列）、`retryMessage`（手动重试）
- [ ] 主进程新增重试调度器（`setInterval` 定期扫描）
- [ ] `MessageSend.vue` 改为通过 IPC 走队列发送

### 验收
1. 手动断网 → 发 3 条 → 气泡显示"发送中"→ 恢复网络 → 自动补发成功
2. 发送过程中强杀 App → 重启后消息仍在队列并自动补发
3. 失败 5 次后 UI 出现"重试"按钮，点击可重新入队

### 常见坑
- **重试与 M1-R1 的配合**：重试必须复用**同一个 `clientMessageId`**，否则幂等失效，对端会收到多条
- **定时器泄漏**：`setInterval` 要在应用退出时 `clearInterval`，参考 `wsClient.js` 的 `clearAllTimers()` 写法
- 本地"发送中"消息的 `message_id` 为 NULL。若此时服务端补偿消息带真实 ID 下来，可能与 NULL 行**重复渲染** —— 需要用 `clientMessageId` 做匹配合并

---

## 第 7 章 M1-R4 增量补偿游标

**学习目标**：理解"游标（cursor）分页"相比"时间窗"的优势，掌握幂等写入。

### 现状（最严重的数据正确性问题）

[ChannelContextUtils.java#L78-L143](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/websocket/ChannelContextUtils.java#L78-L143) 的 `addContext` 中，离线补偿是：

- 按 `lastOffTime`（最后离线时间）查询
- **上限 3 天**
- **每次重连都重跑**

后果：
1. **离线超过 3 天的用户，中间消息永久丢失**
2. 频繁重连会反复拉取相同消息，本地靠主键冲突才发现重复（会报错而非静默忽略）
3. 时间戳有并发边界问题（同一毫秒多条消息可能漏拉）

### 改造设计

**游标定义**：服务端为每个用户维护 `lastOffMessageId`（Redis），查询条件改为 `message_id > lastOffMessageId`。

```
连接建立
  ├─ 读 Redis: im:user:lastMsgId:{userId}
  ├─ 若无 → 首次登录，只拉最近 N 条（如 500），并记录当前最大 messageId
  └─ 若有 → 拉取 message_id > lastOffMessageId 的全部消息（可分页，每页 500）
        └─ 拉完后把游标更新为本次返回的最大 messageId
```

**为什么游标优于时间窗**：
- `message_id` 单调递增，不存在同毫秒漏拉
- 天然幂等：重复拉取同一区间，客户端 `INSERT OR IGNORE` 即可
- 无"3 天"上限，历史消息永不丢

**客户端去重**：`ChatMessageModel.saveMessage` 的 SQL 改为 `INSERT OR IGNORE INTO chat_message ...`。

> 注意：主键是 `(user_id, message_id)`，`INSERT OR IGNORE` 会让重复写变成静默跳过 —— 这是期望行为。
> 但要小心：如果消息内容在服务端被更新（如撤回），`OR IGNORE` 会**丢掉更新**。撤回场景需单独走 UPDATE。

### 你需要实现的部分
- [ ] `RedisComponent` 加 `getLastMessageId(userId)` / `setLastMessageId(userId, id)`
- [ ] `ChatMessageQuery` 加 `lastMessageId` 字段（**先读该类确认现有字段**）
- [ ] `ChatMessageMapper.xml` 的 `query_condition` 加 `message_id > #{lastMessageId}` 分支
- [ ] `ChannelContextUtils.addContext` 改造为游标模式
- [ ] 保留一个配置开关 `im.compensate.mode=time|cursor` 便于灰度（风险对策见 ROADMAP 第六节）
- [ ] `ChatMessageModel.saveMessage` 改 `INSERT OR IGNORE`

### 验收
1. 老用户（有游标）重连 → 只拉到增量消息，抓包确认返回条数远小于 3 天全量
2. 首次登录的新用户 → 只拉最近 500 条，不卡顿
3. 人为把游标改成一个很小的值 → 重连后能补齐大量历史消息且**本地无重复行**

### 常见坑
- **游标更新时机**：必须"拉取成功 → 写回游标"，写成"写游标 → 拉取"，中途失败就会永久丢一段消息
- **群聊消息的 message_id 游标**：群消息的 `contact_id` 是群 ID，按 `message_id > cursor` 拉取时**必须同时限定 `contact_id IN (...)`**，否则会把别人的消息也拉下来（越权）
- 这正好用得上 `V2__reliability.sql` 里新建的 `idx_contact_sendtime` 和 `idx_session_msgid` 索引 —— 改造后在 MySQL 里 `EXPLAIN` 一下，确认走了索引

---

## 第 8 章 M1-R5 重连健壮性

**学习目标**：学会阅读状态机式代码，识别竞态条件（race condition）。

### 现状缺陷（[wsClient.js#L158-L190](file:///c:/Users/Administrator/easy-chat/src/main/wsClient.js#L158-L190)）

```js
const reconnet = () => {
  if (!needReconnect) return
  if (ws != null) ws.close()      // ← 问题1
  if (lockReconnect) return
  lockReconnect = true
  if (maxReConnectTimes > 0) {
    maxReConnectTimes--
    setTimeout(() => { if (!needReconnect) return; createWs() }, 5000)
  } else {
    console.log('连接超时')        // ← 问题2
  }
}
```

| # | 问题 | 分析 |
| --- | --- | --- |
| 1 | `ws.close()` 在 `lockReconnect` 判断**之前** | `close()` 会触发 `onclose` → 再次进入 `reconnet()` → 递归调用。虽然 `lockReconnect` 挡住了后续逻辑，但产生了不必要的递归与多次 `close()` |
| 2 | 超过 5 次后**永久放弃** | 弱网/服务端重启超过 25s，客户端就再也不重连了，用户必须手动重启 App |
| 3 | 固定 5s 间隔 | 服务端宕机时会形成所有客户端每 5s 齐刷刷重连的**惊群效应** |
| 4 | `lockReconnect` 只在 `onopen` 置 false | 若连接建立后立刻断开，`onopen` 没触发则 `lockReconnect` 永远为 true，**死锁** |

### 改造设计

```
reconnet():
  1. 若 !needReconnect → return
  2. 按 maxReConnectTimes-- 判断：
     - 已耗尽 → 进入"长退避模式"（不放弃，间隔上限 30s）
  3. 退避时长 = min(1000 * 2^attempt, 30000) + 随机抖动(0~1000ms)
  4. 把"上次重连尝试时间"作为锁依据，而不是永久布尔锁
  5. 重连成功后：重置 attempt，并主动触发一次增量补偿（衔接 R4）
```

**抖动（jitter）的意义**：多客户端同时断线时，随机抖动把重连时间打散，避免同时冲击服务端。

### 你需要实现的部分
- [ ] 重写 `reconnet()`：指数退避 + 抖动 + 无限重试
- [ ] 修复 `lockReconnect` 死锁（改用时间戳判定或确保在 `onclose`/`onerror` 里也能释放）
- [ ] 重连成功后触发增量补偿（与 R4 联调）
- [ ] `closeWs()`（主动关闭，如强制下线 / 退出登录）必须**不触发**重连 —— 现有 `needReconnect = false` 已实现，验证其生效

### 验收
1. 关掉后端 2 分钟 → 重启后端 → 客户端在 30s 内自动恢复连接并补齐消息
2. 同时开 3 个客户端，观察重连时间是否被打散
3. 点击"退出登录" → 确认不再自动重连

### 代码审查清单
- 是否存在**多个 `setTimeout` 叠加**（每次 `createWs` 都新建，但没有清理旧的）？
- `heartbeatTimer` / `heartbeatTimeout` 在重连时是否都被清理？现有 `clearAllTimers()` 在 `createWs` 开头调用 —— 检查它在 `closeWs()` 里也调用了

---

## 第 9 章 M2-F1 消息撤回

**学习目标**：设计"状态变更型"消息协议，理解版本化消息类型的向后兼容。

### 现状
- `MessageTypeEnum` 无撤回类型
- `ChatMessage` 无 `revokeTime` / `revokeUserId` 字段
- `ChatMessageMapper` 已有 `updateByMessageId`（[ChatMessageServiceImpl.java#L119-L121](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/service/impl/ChatMessageServiceImpl.java#L119-L121)）可复用

### 改造设计

**接口**

```
POST /api/chat/revokeMessage
Request : { messageId: 123 }
Response: { status: "ok" }

服务端校验（缺一不可）：
  1. 消息存在
  2. chatMessage.sendUserId == 当前登录用户  ← 防越权
  3. now - chatMessage.sendTime <= 2 * 60 * 1000   ← 已确认：统一 2 分钟
  4. 消息未被撤回（revokeTime == null）
```

**推送帧**：`{ messageType: 15, messageId, sessionId, contactId, contactType, sendUserId }`

**前端渲染**：消息列表里该条气泡替换为居中的系统提示"你撤回了一条消息" / "对方撤回了一条消息"。

### 你需要实现的部分
- [ ] `MessageTypeEnum` 加 `REVOKE(15, "", "消息撤回")`
- [ ] `ChatMessage` 加 `revokeTime` / `revokeUserId`
- [ ] `ChatMessageMapper.xml` 的 `updateByMessageId` 补这两个字段的 `<if>`
- [ ] `ChatController` 加 `/revokeMessage`
- [ ] Service 实现校验 + 更新 + 推送
- [ ] **常量抽取**（遵守项目规范，禁止魔法数字）：`MAX_REVOKE_WINDOW_MS = 2 * 60 * 1000`
- [ ] 前端右键菜单 + `wsClient.js` case 15 分支 + `ChatMessage.vue` 渲染分支
- [ ] 本地表加 `revoke_time` / `revoke_user_id`（走 `alter_tables`）

### 验收
1. 发送后 1 分钟内撤回 → 双方视图都变为"已撤回"
2. 超过 2 分钟撤回 → 返回错误提示
3. 用 A 的 token 撤回 B 的消息 → 返回无权限
4. 撤回后刷新/重新登录 → 撤回状态仍在（持久化正确）

### 常见坑
- **群聊撤回的权限**：目前设计只有发送者能撤回。若 M3 要做管理员强制撤回，建议**现在就把校验抽成一个方法** `canRevoke(userId, chatMessage, isAdmin)`，M3 直接复用
- **撤回后 `chat_session.lastMessage`**：若撤回的是会话最后一条，会话列表里还显示着撤回前的内容 —— 需要考虑是否回滚 `lastMessage`（微信的处理是显示"xxx撤回了一条消息"）

---

## 第 10 章 M2-F2 消息删除（仅删本地）

**学习目标**：理解"逻辑删除"与"视图隔离"，以及为什么 IM 删除是单方的。

### 改造设计

**已确认决策**：仅删本地，对方仍可见。

```
POST /api/chat/deleteMessage
Request : { messageIds: [123, 124] }   // 支持批量
服务端：写 chat_message_delete(user_id, message_id, session_id, delete_time)
查询消息列表时：LEFT JOIN / NOT IN 排除已删除的
```

**本地侧**：同时从本地 `chat_message` 表物理删除，并更新会话的 `lastMessage` / 未读数。

### 你需要实现的部分
- [ ] 执行 `V2__reliability.sql` 里的 `chat_message_delete` 建表
- [ ] 新建 `ChatMessageDelete` PO + Mapper + XML
- [ ] `ChatController` 加 `/deleteMessage`
- [ ] `ChatMessageMapper.xml` 的消息列表查询加排除条件
- [ ] 前端右键"删除" + 多选批量删除
- [ ] 本地 `ChatMessageModel` 加 `deleteMessages(ids)`

### 验收
1. A 删除消息 → A 看不到，B 仍能看到
2. 删除会话最后一条 → 会话列表的 `lastMessage` 正确回退
3. 批量删除 10 条 → 1 次请求完成

---

## 第 11 章 M2-F3 引用回复 + @提醒

**学习目标**：在不新增消息类型的前提下扩展消息能力（字段扩展 vs 类型扩展的取舍）。

### 改造设计

**不新增消息类型**，`messageType` 仍是 `CHAT(2)`，只扩展字段：

```
POST /api/chat/sendMessage
Request: {
  messageType: 2,
  messageContent: "同意",
  quoteMessageId: 100,        // 可选，引用回复
  atUserIds: "u1,u2"          // 可选，@的用户
}
```

**被@提醒**：`chat_session_user` 加 `no_read_at_count`。被@的用户在该群会话上显示独立红点（`[有人@我]`），进入会话后清零。

> 已确认：**已读仅单聊**。所以 @ 提醒只影响群聊的**未读计数展示**，不做已读回执。

### 你需要实现的部分
- [ ] `ChatMessage` 加 `quoteMessageId` / `atUserIds`
- [ ] `ChatSessionUser` 加 `noReadAtCount`
- [ ] `ChatMessageQuery` / 会话查询支持该字段
- [ ] 发送时若 `atUserIds` 非空 → 更新目标用户的 `no_read_at_count + 1`
- [ ] 前端：引用条 UI（显示被引用消息的发送人 + 摘要）、点击跳转定位
- [ ] 前端：@ 选择器（群成员列表 + 输入框内高亮）
- [ ] 前端：会话列表 `[有人@我]` 标识
- [ ] 本地表两个 `alter_tables` 迁移

### 验收
1. 引用一条消息回复 → 双方都看到引用条，点击可定位到原消息（已在视口内则高亮闪烁）
2. 群聊 @某人 → 该成员会话列表出现 `[有人@我]`，进入后消失
3. @ 不存在的成员 → 忽略，不报错

### 常见坑
- **被引用的消息可能已被删除/撤回** → 前端要能降级显示"引用内容已失效"
- **@ 的越权**：只能 @ 群成员，服务端要校验 `atUserIds ⊆ 群成员列表`，否则可用来探测用户是否存在
- 输入框内的 @ 高亮需要富文本（contenteditable），比 textarea 复杂 —— 这是本任务最花时间的部分

---

## 第 12 章 M2-F4 消息转发

**学习目标**：批量数据一致性与用户操作反馈设计。

### 改造设计

```
POST /api/chat/forwardMessage
Request: {
  messageIds: [100, 101, 102],   // 单条或多条
  targetContactIds: ["u9"],      // 可多选目标
  forwardType: 0 | 1             // 0逐条转发 1合并转发
}
```

- **逐条转发**：为每条原消息在目标会话生成一条新消息（`messageType` 沿用原类型）
- **合并转发**：生成一条汇总消息（可新增 `messageType=16 MERGE_FORWARD`，正文存 JSON 摘要）
- **一致性要求**：多条目标会话要么全成功要么全失败 → Service 上加 `@Transactional`
- **安全**：只能转发**自己有权限访问**的消息（是自己发的、或在自己参与的会话里）

### 你需要实现的部分
- [ ] `ChatController` 加 `/forwardMessage`
- [ ] Service 实现（注意 `@Transactional`）
- [ ] 权限校验：遍历 `messageIds` 确认可访问
- [ ] 前端转发弹窗（选择会话，复用联系人/群列表组件）
- [ ] 合并转发若要新增消息类型，先在 `MessageTypeEnum` 登记

### 验收
1. 转发 3 条到 1 个会话 → 目标会话出现 3 条
2. 转发 1 条到 3 个会话 → 3 个会话都收到
3. 转发别人的私有消息 → 被拒绝

---

## 第 13 章 M2-F5 消息搜索（本地即时 + 服务端补全）

**学习目标**：掌握"本地优先 + 远端补全"的搜索架构与结果合并。

### 改造设计

**前端流程**

```
用户输入关键词
  ├─ 立即：查本地 SQLite（LIKE '%kw%'），渲染结果
  └─ 异步：请求 POST /chat/searchMessage
        └─ 返回后按 message_id 去重合并，追加渲染
```

**服务端接口**

```
POST /api/chat/searchMessage
Request: { keyword, contactId?, minTime?, maxTime?, pageNo, pageSize }
```

**权限（必做）**：只能搜自己参与的会话。用 `contactId IN (我的联系人+群列表)` 限定，直接复用 `redisComponent.getUserContactList(userId)`（[ChatMessageServiceImpl.java#L131](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/service/impl/ChatMessageServiceImpl.java#L131) 已在用）。

### 你需要实现的部分
- [ ] 服务端 `/searchMessage` + 权限限定 + 分页
- [ ] 本地 `ChatMessageModel` 加 `searchMessage(keyword, sessionId)`
- [ ] 前端全局搜索页 `views/contact/Search.vue`（已存在，扩展它）
- [ ] 结果高亮（关键词标红）
- [ ] 点击结果 → 跳转到会话并定位到该消息（滚动 + 高亮）
- [ ] M3 再考虑上 MySQL `FULLTEXT` 或 ES

### 验收
1. 输入关键词 → 本地结果 < 100ms 出现
2. 服务端结果返回后无重复条目
3. 搜索包含别人私聊的群 → 搜不到越权内容
4. 点击结果能正确定位

---

## 第 14 章 M3 工程化（概要）

| 项 | 关键动作 |
| --- | --- |
| TypeScript | 根目录建 `tsconfig.json`，`strict: false`、`allowJs: true`；`electron.vite.config.mjs` 的 alias 保持 `@ → src/renderer/src`；先转 `utils/` |
| 管理端强制撤回 | 复用 F1 抽出的 `canRevoke(..., isAdmin)`，新增 `/admin/revokeMessage` 绕过时限 |
| 单测 | 后端加 `spring-boot-starter-test`；优先测 `saveMessage` 的幂等分支（R1）与权限分支 |
| 安全 | Redis 令牌桶限流；敏感词 DFA；上传白名单校验 |
| 监控 | `spring-boot-starter-actuator` + Micrometer |

---

## 附录 A 任务依赖图

```
M0-1 Swagger ──┐
M0-2 配置外置   ├─→ M1-R1 幂等 ─→ M1-R2 ACK ─→ M1-R3 待发队列
M0-3 DDL ──────┤                      │
M0-4 Actuator ─┘                      ↓
                              M1-R4 增量补偿 ─→ M1-R5 重连修复
                                       │
                                       ↓
                    M2-F1 撤回 / F2 删除 / F3 引用@ / F4 转发 / F5 搜索
                                       │
                                       ↓
                                   M3 工程化
```

**关键依赖说明**：
- `M1-R3` 与 `M1-R1` **强耦合**：重试必须复用同一个 `clientMessageId`
- `M2-F1/F2` 依赖 `M0-3` 的 DDL
- `M2-F3` 依赖 `M1-R1`（引用需要稳定标识）
- `M1-R5` 的重连恢复要调用 `M1-R4` 的补偿接口

---

## 附录 B 每完成一个任务的代码审查清单

1. **幂等性**：同样的请求执行两次，结果是否一致？
2. **并发**：两个请求同时到达，是否有竞态？是否依赖了 DB 唯一约束兜底？
3. **越权**：能否用 A 的身份操作 B 的数据？所有 `contactId` / `messageId` 都做归属校验了吗？
4. **异常**：catch 块是否吞掉了异常？是否返回了用户可理解的错误码？
5. **常量**：是否有魔法数字/字符串散落在逻辑里？是否已抽取为常量或枚举？
6. **注释**：修改的方法是否**保留了原有注释**并补充了意图说明？
7. **性能**：新增的查询走索引了吗？`EXPLAIN` 看过吗？
8. **兼容**：老版本客户端遇到新字段/新消息类型会崩溃吗？（未知 `messageType` 应被忽略而非报错）
9. **日志**：关键分支有日志吗？日志里会不会打印敏感信息？
10. **回滚**：这次改动如果出问题，怎么快速回滚？（DDL 是否可逆、是否有配置开关）

---

## 附录 C 本文档中标注「需先确认」的事项

实现前请先读这些文件确认字段，避免凭空造字段：

| 待确认项 | 需读文件 |
| --- | --- |
| `ChatMessageQuery` 现有字段 | `entity/query/ChatMessageQuery.java` |
| `ChatSessionUser` 现有字段 | `entity/po/ChatSessionUser.java` |
| `ChatMessageMapper` 接口方法 | `mapper/ChatMessageMapper.java` |
| `RedisComponent` 现有方法 | `redis/RedisComponent.java` |
| `Chat.vue` 消息渲染分支 | `views/chat/Chat.vue` |
| `MessageSend.vue` 发送方法 | `views/chat/MessageSend.vue` |
| `Api.js` 现有接口 | `utils/Api.js` |
| 登录拦截器类名 | `annotation/` 或 `aspect/` 目录 |
| `MessageSendDto` 是否需加字段 | `entity/dto/MessageSendDto.java`（已读，字段清单见第 5 章） |