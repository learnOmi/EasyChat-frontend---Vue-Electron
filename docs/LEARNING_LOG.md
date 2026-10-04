# EasyChat 带教实录（Learning Log）

> **用途**：记录每一次教学单元的完整过程 —— 讲了什么、用户卡在哪、我的判断失误、能力评级变化。
> **维护方式**：每完成一个教学单元追加一节，**不修改历史记录**（发现错误用「更正」标注，保留演进痕迹）。
> **关联文档**：[ROADMAP.md](./ROADMAP.md) ｜ [DESIGN_DETAIL.md](./DESIGN_DETAIL.md)

---

## 0. 能力评级说明

| 等级 | 表现 |
| --- | --- |
| **L0** | 需要完整思路引导 |
| **L1** | 需要关键点提示才能推进 |
| **L2** | 能独立完成，review 时发现小问题 |
| **L3** | 能独立完成，且能主动解释取舍与风险 |

目标：M1 结束时 R1–R3 达到 L2；M2 结束时主要任务达到 L3。

---

## 1. 带教节奏（2026-09-29 确定，随用户反馈调整过两次）

**当前节奏 —— 三步循环：**

1. **我讲原理 + 直接给参考答案并解释推理过程 + 给关键代码片段**（不让用户先猜）
2. **用户动手写代码**（我给接口契约与验收标准）
3. **轻量 review**（用户先自评，我再补关键问题）

**语言风格要求：** 少用多层表格和 bullet 堆砌；概念用连贯的直白话讲清；像资深工程师在白板前讲课。

**过程记录要求：** 每个教学单元记入本文件，**包括我自己的判断失误**，保留演进痕迹。

**演进记录：**

- 2026-09-29 初版：严格模式（5 步，其中 2 步不给答案）
- 2026-09-29 调整：用户反馈"进度太慢"，改为上述三步循环
- 2026-09-29 调整：用户反馈"AI 腔重"，加入语言风格要求
- 2026-09-29 调整：用户要求 ①教学过程落档 ②Step 1 附带关键参考代码 → 建立本文件；参考代码写入 DESIGN_DETAIL 第 1 章「参考示范」小节

---

## 第 0 课｜项目现状分析与计划制定

**日期**：2026-09-29
**目标**：在动手前把项目现状摸清，产出可执行的完善计划。

**产出：**

- [ROADMAP.md](./ROADMAP.md) —— 路线图，含 M0～M3 四个阶段、7 项已确认决策
- [DESIGN_DETAIL.md](./DESIGN_DETAIL.md) —— 代码级设计文档，13 章 + 3 附录
- `easy-chat-java/docs/sql/V2__reliability.sql` —— 数据库变更脚本

**过程中用户做的关键决策（7 项）：**

1. 消息删除 → 仅删本地
2. 已读回执 → 仅单聊
3. 撤回时限 → 统一 2 分钟
4. 消息搜索 → 本地即时 + 服务端补全
5. 管理员强制撤回 → 做，放 M3
6. TypeScript → 渐进式，不动存量
7. ACK / 已读的 Redis 状态 → 不持久化

**技能收获：**

- 学会了用「先定义问题边界、再给方案、最后权衡」的方式做技术决策，而不是直接接受第一个方案
- 认识到**离线消息补偿按时间窗全量拉取、上限 3 天**会导致超期未登录用户永久丢消息 —— 这是从代码里读出来的，不是文档里写的
- 理解了「需求确认」在工程里的位置：7 个决策里有 5 个如果不确认，实现方向会完全不同

**能力评级**：L1（能参与决策并给出倾向，但对技术细节需要引导）

---

## 第 1 课｜M0-1 接口文档（Swagger / Knife4j）

**日期**：2026-09-29
**目标**：搞懂 OpenAPI 的原理，并把文档接进项目。
**状态**：教学中（用户尚未提交代码）

### 1.1 讲了什么

**（1）OpenAPI 的真正价值是「契约先行」，不是「生成文档」**

文档只是副产品。真正的收益是让接口信息与代码同源，杜绝"接口改了前端不知道"的漂移。接口协作分三层：口头约定（必然漂移）→ 手写文档（写完即过期）→ 代码即契约（不会漂移）。这一层认知会直接决定 M3 引入 TypeScript 时，为什么能靠 OpenAPI 自动生成前端类型。

**（2）springdoc 与 Knife4j 是分工关系**

springdoc 扫描 Controller 生成 OpenAPI 3 规范的 JSON（`/v3/api-docs`）；Knife4j 读取该 JSON 渲染成可调试页面（`/doc.html`）。两者都要装。

**（3）为什么必须用 jakarta 版本（底层原理）**

Java EE 于 2017 年由 Oracle 捐给 Eclipse 基金会并改名 Jakarta EE；因 Oracle 保留 `javax.*` 商标权，Jakarta EE 9 起包名整体迁移到 `jakarta.*`。Spring Boot 3 基于 Spring Framework 6，后者要求 Java 17 + Jakarta EE 9+。故本项目全部 servlet 包为 jakarta 开头（见 `GlobalOperationAspect.java` 第 10 行）。结论：springfox 淘汰、springdoc 必须 2.x、Knife4j 必须选 jakarta 版。

**选错的表现**分两种：启动直接报错（易发现）；或**启动正常、页面能开、接口列表为空**（静默失效，难查）。

**（4）本项目的鉴权机制 —— 我在此犯了错，见 1.2**

### 1.2 我在本课中的判断失误（已更正）

**错误结论**：原计划书写的是"在登录拦截器的 `excludePathPatterns` 中放行 `/doc.html`"。

**纠错过程**：动手前 grep `addInterceptors|WebMvcConfigurer|HandlerInterceptor`，**零匹配**。改查 `@Aspect|@Pointcut` 找到真实机制。

**实际情况**：

- `annotation/GlobalInterceptor.java` —— `@Target(ElementType.METHOD)`，含 `checkLogin()` 默认 `true`、`checkAdmin()` 默认 `false`
- `aspect/GlobalOperationAspect.java` —— `@Before("@annotation(com.easychat.annotation.GlobalInterceptor)")`

**这是白名单模型，与拦截器的黑名单模型完全相反：**

| | 拦截器（黑名单） | 注解切面（本项目） |
| --- | --- | --- |
| 默认行为 | 拦 | **放** |
| 例外方式 | `excludePathPatterns` 放行 | 标 `@GlobalInterceptor` 才拦 |
| 漏配后果 | 页面打不开（立刻发现） | **接口裸奔（毫无提示）** |

`/doc.html` 不是 Controller 方法，永不命中切面，**无需放行任何路径**。

**教训（比 Swagger 本身更值钱）**：我按"多数 Spring 项目用拦截器"的经验做了假设，没有先验证。白名单模型下"忘记加注解"是**静默失败** —— 这类设计必须配机械化自查动作（如写完 grep 一遍 `@PostMapping`，逐条确认下方有注解）。

**已同步更正**：ROADMAP M2 安全提醒、DESIGN_DETAIL 第 1 章、项目记忆 Lessons Learned。

### 1.3 三个问题的参考答案（要点）

**Q1｜白名单模式下接口何时会意外免登录**

- 主因：新增方法忘了加注解（无报错）
- 结构性原因：`@Target(ElementType.METHOD)` 只能标方法，**无法按类兜底**，方法一多必漏
- Spring AOP 基于代理，**同类内部方法调用（`this.xxx()`）不走代理**，切面失效（本项目切 Controller，暂安全；若挪到 Service 层就会咬人）
- `@GlobalInterceptor(checkLogin = false)` 因 `checkAdmin` 默认 `false`，两条件皆不成立 → **注解等于没挂**
- 好消息：切面 `catch (Throwable e)` 会抛 `CODE_500`，不会吞异常后放行

**Q2｜Knife4j 暴露 `/admin/**` 是否算风险**

- 泄露的是**攻击面**而非数据，属信息泄露，风险等级**中低**
- 且文档页面本身公开可访问（白名单不拦它）
- 缓解手段四选：Spring Profile（简单，但生产查不了文档）／配置开关 `${KNIFE4J_ENABLE:false}`（灵活，多一个运维项）／Nginx 拦截（零代码改动，但内网直连可绕过）／给文档页加登录（本项目需真 Filter，性价比最低）
- 推荐：**Profile + 环境变量组合**，开发开、生产关

**Q3｜页面能开但接口列表为空，如何排查**

- 第一动作：F12 看 Network 里 `/v3/api-docs` 的实际返回 —— 404 是路径问题、错误 JSON 是被拦、正常 JSON 但列表空则问题在分组配置或 Knife4j
- 版本不兼容：`mvn dependency:tree` 确认 springdoc 是 2.x（1.x 在 Boot 3 下正好是"页面正常、列表为空"）
- 包扫描：主类在 `com.easychat`，Controller 在其子包，正常可扫；若手写 `GroupedOpenApi` 路径匹配则易错，可对比 `/v3/api-docs` 与 `/v3/api-docs/分组名`
- Controller 未注册为 Bean（漏 `@RestController` 等），看启动日志的映射信息

### 1.4 用户待完成任务（Step 3）

**目标**：`http://localhost:5050/api/doc.html` 可打开、可见接口分组、能调通 `/account/login`

**任务清单：**

1. `pom.xml` 加 springdoc + knife4j 依赖，版本选对
2. 新建 `com.easychat.config.OpenApiConfig`，定义 API 基本信息与 header 传 token 的 security scheme
3. 给 `AccountController` 加 `@Tag` / `@Operation` 注解
4. 启动验证

**验收：**

- 页面能开且 URL 带 `/api` 前缀（否则是 `context-path` 问题）
- 能看到 `/account/login`
- 页面上调试能拿到正常业务返回

**易错点提醒：**

- `/account/login` **没有** `@GlobalInterceptor`（登录接口本就不需要登录），应能匿名调通
- `com.easychat.config` 包当前**不存在**，需新建；它在 `com.easychat` 下会被自动扫描

### 1.5 关于「顺手验证结论」—— 我示范了一次

我在 Q1 里断言「`@GlobalInterceptor(checkLogin = false)` 等于没挂」。这个结论最初只是从注解默认值**推导**出来的，属于**未经证实的假设**。

随后我去读切面源码做了验证，`GlobalOperationAspect` 第 41–42 行：

```java
if (interceptor.checkLogin() || interceptor.checkAdmin()) {
    checkLogin(interceptor.checkAdmin());
}
```

`checkLogin` 默认 `true`、`checkAdmin` 默认 `false`；若显式写 `@GlobalInterceptor(checkLogin = false)`，两个条件都不成立 → 整个 if 块被跳过 → **注解确实等于没挂**。结论从「推导」升级为「源码证实」。

**这是本课最该带走的习惯**：说出口的每个技术结论，都要能指到证据（某行代码／某次实验／某份文档）。区分「我猜」和「我验过」，是 debug 时最省时间的能力。

同一轮还确认了 token 的传递方式（`GlobalOperationAspect` 第 56 行）：

```java
String token = request.getHeader("token");
```

正因读到这一行，才敢在 `OpenApiConfig` 里把 security scheme 的 header 名写成 `"token"`。

### 1.6 排障实录：`/doc.html` 返回 `NoHandlerFoundException`

**现象**：

```
org.springframework.web.servlet.NoHandlerFoundException: No endpoint GET /api/doc.html.
```

**用户已完成的部分**：pom 加依赖（springdoc 2.3.0 + knife4j 4.5.0）、`knife4j.enable` 开关 —— 均正确。

**排查过程（五步，每步都有证据，全程无猜测）：**

| 步骤 | 手段 | 结果 |
| --- | --- | --- |
| 1 | grep `pom.xml` | 依赖已加 ✅ |
| 2 | 查 `.m2` 仓库 | `knife4j-openapi3-ui-4.5.0.jar` 已下载 ✅ |
| 3 | 解压查 jar 内容 | `META-INF/resources/doc.html` 确实存在 ✅ |
| 4 | 读 `application.properties` | 第 18 行 `spring.web.resources.add-mappings=false` ❌ |
| 5 | `javap` 查 `Knife4jAutoConfiguration` | **未实现 `WebMvcConfigurer`**，不注册资源处理器 → 逻辑闭环 |

**根因**：`add-mappings=false` 关闭了 Spring Boot 的默认静态资源映射，而 `doc.html` 恰是静态资源，knife4j 自己又不注册处理器 → 无处理器 → 404。

**修复**：方案 B —— 保持全局关闭，在 `OpenApiConfig` 中精准放开 `/doc.html` 与 `/webjars/**`。

**方法论价值（本节的真正重点）**：整条排查里没有一次"猜"。`grep`、查本地仓库、解压看 jar、`javap` 看类签名 —— 全是**可复现、可证伪**的动作。

其中第 5 步最关键：它把「knife4j 依赖 Spring Boot 默认静态资源处理」这个**假设**，变成了**事实**。如果跳过这步直接改配置，就成了"试一下看看行不行"，即使碰对了也不知道为什么对。

**顺带发现（可用于 Q2）**：`Knife4jAutoConfiguration` 里有个 `JakartaProductionSecurityFilter`，说明 knife4j **自带生产环境保护**，对应属性 `knife4j.production`。这很可能就是 Q2「生产环境关闭文档」的最优解 —— 零代码。待实测确认。

### 1.7 能力评级

**本课评级：L1（需要关键提示才能推进）**

判断依据：

- ✅ 能按参考示范正确完成依赖引入与配置落地，四个步骤一次到位，没有出现拼写或版本错误
- ✅ 遇到问题时知道来问，并准确贴出了异常栈
- ⚠️ 但面对 404 时没有自行排查 —— 这个场景恰好就是我上一课在 Q3 里讲过的情况，属于"知识有了、还没形成条件反射"

**从 L1 到 L2 需要做的**：下次遇到类似问题，先自己走一遍"证据链"再问我。哪怕只走前两步（查依赖、看浏览器 Network），结论的质量也会完全不同。

**提示**：本课 Q3 讲的排查方向里，"路径/前缀"、"依赖版本"、"容器配置"三条，其实已经覆盖了本次的根因方向。把讲过的东西**用起来**，就是 L1 → L2 的距离。

---

## 第 2 课｜M0-2 配置外置

**日期**：2026-09-30
**目标**：把敏感配置与环境相关配置从代码中剥离，修复 `AppConfig` 的路径逻辑 bug。
**状态**：用户已提交作业，review 完成，3 项待补

### 2.1 讲了什么

**（1）12-Factor App 第 3 条 Config 的可操作判据**

不说"配置要放环境变量里"这种口号，而是给一个可验证的问题：**同一份构建产物（jar），能不能不加修改地跑在开发、测试、生产三个环境？** 需要重新打包才能换环境 → 配置被硬编码了。

**（2）Spring 占位符 `${KEY:default}` 与优先级**

冒号左边是"找什么"，右边是"找不到用什么"。查找优先级：命令行参数 > 环境变量 > jar 外配置 > jar 内配置。

**（3）`${key:}` 与 `${key}` 是两种设计意图**

前者"缺了也能跑"，后者"缺了就该死"。用哪种取决于该配置是否不可或缺 —— 这是 Fail Fast 原则在配置层的体现。

**（4）`${user.home}` 是 JVM 系统属性**

不是 Spring 语法糖。Windows 是 `C:\Users\xxx`，Linux 是 `/home/xxx`，macOS 是 `/Users/xxx`，天然跨平台，是解决绝对路径问题的正确工具。

### 2.2 现状调查中的两个意外发现

**发现一：密码从未泄露，但仓库 clone 后跑不起来**

`.gitignore` 用 `*.properties` 一刀切，导致 `application.properties` **从未被 git 追踪**（`git log --all -- <path>` 无记录）。所以"密码进历史提交"这个常见风险在本项目**不成立**。

但反面的问题更严重：任何人 clone 都拿不到数据库配置、`ws.port`、`project.folder`、`admin.emails`。而 `AppConfig` 第 15 行 `@Value("${admin.emails}")` **没有默认值** → 启动直接失败，且错误信息不友好。

**这印证了一条原则**：`.gitignore` 用通配符一刀切是反模式。正确做法是**只忽略本地私有覆盖文件**，模板文件必须入库。

**发现二：`AppConfig.getProjectFolder()` 存在真实逻辑 bug**

```java
// 错误写法（`&&` 两侧条件互相排斥，实际永远走错分支）
if (StringTools.isEmpty(projectFolder) && !projectFolder.endsWith("/")) {
```

- 非空但缺结尾斜杠（如 `C:/data`）→ 短路 → **不补斜杠**
- 空串（属性缺失）→ 补斜杠 → 返回 `"/"` ← **文件会往根目录写**

正确的条件里少了一个 `!`。之所以线上没出事，是因为配置值**恰好**带结尾斜杠（`.../easychat/`）。

**教学点（本课核心认知）**：配置外置的价值不只是安全，而是把**"靠巧合在工作"的系统**变成**"靠契约在工作"的系统**。路径一旦可配置，别人填 `C:/data` 立刻踩雷。

### 2.3 用户作业 review

**用户选择的路线**：Profile 隔离 + 占位符，即 `application.properties`（入库）只留 `spring.profiles.active=local`，真实配置全部搬到 `application-local.properties`（被 gitignore）。

**做对的部分：**

- ✅ `application.properties` 已入库（`git ls-files` 确认），且**零敏感信息** —— 本课核心目标达成
- ✅ `application-local.properties` 被正确忽略，未出现在 `git status` —— 无泄露
- ✅ `AppConfig.getProjectFolder()` 逻辑 bug **已修复**（第 27 行补上了 `!`）
- ✅ 七项配置全部占位符化，嵌套占位符与 `${user.home}` 使用正确
- ✅ 顺手保留了 `knife4j.production` 的注释待用

**待补的 3 项：**

**① 认知问题（最重要）：`${EASYCHAT_DB_PASSWORD:真实密码}` 是假外置**

用户的理由："给默认值，因为目前专注本地 local"。

问题在于：`application-local.properties` **本来就被 gitignore**，这个文件里写什么都不会入库。所以占位符在这里**没有安全收益**，却保留了明文密码 —— 属于"保险拆了一半"。

**核心认知**：**占位符保护的是「会被提交的文件」。** 对已忽略的文件用占位符，只是把秘密换了个写法，并没有"外置"任何东西。判断标准是"这个文件会不会进版本库"，不是"我有没有用 `${}`"。

**② 功能问题：`spring.profiles.active=local` 硬编码了环境**

入库的配置写死 profile，意味着该 jar 无法"不加修改地跑在三个环境"，恰好违反本课第一条判据。

修法：`spring.profiles.active=${SPRING_PROFILES_ACTIVE:local}` —— 开发默认 local（免配置），生产用环境变量覆盖。

**③ 静默失效：`.gitignore` 第 49–50 行 `*- local.properties` 带空格**

gitignore 模式是字面量匹配，`*- local.properties`（`-` 后有空格）只会匹配文件名里真带 "- " 的文件，实际等于一条废规则。

影响很小（47–48 行已精准忽略目标文件），但它是**"看起来生效实则无效"**的典型 —— 正是本课反复强调的那类隐患。

**④ 补充项：缺 `application-local.properties.example` 模板**

由于真实配置只存在于被忽略的文件里，新人 clone 后无法启动，且不知道要配什么。需要入库一份模板。

**⑤ 架构观察：配置分类错了 —— 非敏感项也搬进了私有文件**

用户把 `application.properties` **清空到只剩一行**，所有配置（含 `mybatis.mapper-locations`、`spring.servlet.multipart.*`、`logging.pattern`、`spring.web.resources.add-mappings`）全搬进了私有文件。

这些项**每个环境都一样**，属于"应用行为"，应该跟代码走。搬进私有文件的后果：应用的**结构**变成了依赖某台机器上的文件才成立 —— 新人 clone 后连 mapper 扫描路径都不知道。

**正确的分类框架（本课应带走的核心模型）** —— 配置分三类：

| 类型 | 例子 | 放哪 |
| --- | --- | --- |
| ① 应用结构/行为 | `mybatis.mapper-locations`、上传大小限制、日志格式、静态资源开关 | **入库**（跟代码走） |
| ② 环境连接信息 | 数据库 URL、Redis host、服务端口 | 外置，给安全默认值 |
| ③ 机密 | 数据库密码、第三方密钥 | **绝不入库**，环境变量注入 |

用户实际只按"敏感/不敏感"二分，漏掉了第①类。

### 2.4 能力评级

**本课评级：L2（能独立完成，review 时发现小问题）**

较第 1 课的 L1 有明确提升。依据：

- ✅ 能独立选择技术路线（Profile 隔离），且该路线本身是合理的
- ✅ 主动修复了别人指出的逻辑 bug，改法完全正确
- ✅ 面对"给不给默认值"的权衡，给出了自己的判断和理由 —— 这正是 L2 要求的"能解释取舍"
- ⚠️ 但判断依据有偏差：把"用了占位符"等同于"外置了秘密"，没有意识到**决定安全性的是文件是否入库**

**从 L2 到 L3 需要做的**：结论正确只是一半，还要检验**结论所依赖的前提是否成立**。本例中"被 gitignore 的文件无需占位符"这个前提，只要多问一句"这个文件会被提交吗？"就能发现。

### 2.5 本课遗留技术债

- `target/` 下的编译产物（如 `target/classes/.../Application.class`）已被 git 追踪，`.gitignore` 对已追踪文件无效，需 `git rm -r --cached target` 清理 → 归入 M3
- `getProjectFolder()` 在配置缺失时返回 `""`，会让文件落到工作目录。可考虑改为返回 `null` 或显式抛异常 → 归入 M1 一并处理

---

## 第 3 课｜M0-3 数据库迁移（Flyway）

**日期**：2026-09-30
**目标**：把散落的裸 SQL 脚本切换为受管迁移，理解版本账本与校验和机制。
**状态**：用户已提交作业（`easy-chat-java/doc/dev-report/introduce-flyway.md`），review 完成，两处 V1 缺陷与四处 V2 缺陷均已修正，待正式库迁移验证

### 3.1 讲了什么

**（1）假契约比"没有"更危险**

`docs/sql/V2__reliability.sql` 采用了 Flyway 的命名规范（`V2__` 前缀），项目里却没有 Flyway。文件永远不会执行，同时让人误以为"已经被自动保证了"。形式上的规范配上不存在的执行机制，就是假契约。

**（2）迁移工具真正解决的四件事**

版本账本（`flyway_schema_history` 表，而不是人的记忆）／一次性（MySQL 8 的 `ADD COLUMN` 不支持 `IF NOT EXISTS`，重复执行报 `Duplicate column name`）／顺序（代码依赖列存在，先发代码后改库会全挂）／**校验和**（已执行过的脚本被改动 → 启动直接失败）。

重点讲了校验和为什么选择"失败"而不是"自动修复"：它**无法判断**是文件错了还是库错了，这种歧义只能由人来裁决 —— Fail Fast 原则在数据层的体现。

**（3）baseline 的语义（查证了官方原文，未凭印象）**

`baselineOnMigrate=true` + `baseline-version=1` 时，官方定义原文是 "Only migrations above baselineVersion will then be applied"。于是同一份仓库同时覆盖两种情况：存量库（记为基线 V1、跳过 V1、执行 V2）与全新空库（不建基线、V1 → V2 依次执行）。

顺带查到一个官方警告：该开关会**移除"防止误连库"的安全网** —— URL 配错连到别的库时 Flyway 不再拒绝，而是把它当基线往上迁。生产环境更稳妥的做法是用手工 `baseline` 命令。

**（4）DDL 执行算法（纠正了我自己的错误知识）**

我在 V2 里写过 `ALGORITHM=INPLACE, LOCK=NONE`，并注释称"避免锁表"。实际上 MySQL 8.0.12+ 的 `ADD COLUMN` 默认走 **INSTANT**（仅改元数据、不重建表），显式写 `INPLACE` 反而把执行路径**降级**。教训：显式指定"看起来更保守"的参数，不等于结果更好。

### 3.2 本课的关键判断：改迁移脚本前，先确认它"有没有被记账"

用户要求我修正 V2。动手前先查 `easychat` 是否存在 `flyway_schema_history` 表 —— **不存在**，说明 V2 从未在任何保留下来的库上执行过，其 checksum 未被记录，此时修改文件是安全的。

如果它已经被执行过，这一改就是**破坏性操作**：下次启动 Flyway 会拿新 checksum 与账本里的旧值比对，直接校验失败、应用起不来，只能靠 `flyway repair` 收拾。

**这正是 3.1(2) 那个机制在真实场景中的样子。** 由此得到一条通用规则：**迁移脚本一旦被任何环境执行过，就只能新增、不能再修改。**

### 3.3 用户作业 review

**交付物**：`doc/dev-report/introduce-flyway.md`（含设计推导 + 端到端验证结果）、`src/main/resources/db/migration/V1__baseline.sql`、`V2__reliability.sql`（由 `docs/sql/` 移入，旧目录已删）。

**做对的部分（质量高于预期）：**

- ✅ 没有停留在"照做"，而是**新建临时库 `easychat_fw_test` 做端到端验证，并主动隔离正式库** —— 先在副本上验证、再动真库，这是生产级的安全意识
- ✅ 验证结论给到了证据级别（`Successfully baselined schema with version: 1`、rank1=BASELINE、rank2=SQL、`now at version v2`），而不是"应该可以了"
- ✅ 额外加了 `clean-disabled=true` 防 `flyway clean` 误删整库，并给出了理由 —— 这一步我并未要求
- ✅ 用 `--result-file` 代替 PowerShell `>` 重定向，**并说明原因**（重定向会写出 UTF-16 损坏脚本）—— 这是踩过坑才有的警觉
- ✅ 删除 `docs/sql/` 旧目录，消除了双真相源
- ✅ V1 头部写明"请勿手工修改本文件"，把 checksum 约束前置进了文件本身

**发现的缺陷（6 处，均已修正）：**

V2 有 4 处，都是我写的：

1. `revoke_user_id` `VARCHAR(32)` → `VARCHAR(12)`
2. `chat_message_delete.user_id` `VARCHAR(32)` → `VARCHAR(12)`
3. 同表 `session_id` `VARCHAR(64)` → `VARCHAR(32)`
4. 两处 `ALGORITHM=INPLACE, LOCK=NONE` 把 INSTANT 降级，删除

根因：写脚本时**没有先去库里读现状**，凭印象定义了字段宽度（全库约定是 `user_id`/`contact_id` 为 `varchar(12)`、`session_id` 为 `varchar(32)`）。与第 1 课 `/doc.html` 那次同源 —— 没验证就动手。

V1 有 2 处，出现在用户生成的产物里：

5. 生成命令漏了 `--skip-add-drop-table`，文件里残留 **9 行 `DROP TABLE IF EXISTS`**。后果：基线本应只在空库执行（此时 DROP 是空操作，看不出问题），但一旦历史表丢失导致 V1 重跑，会**静默删除全部业务表**。移除 DROP 的代价是"表已存在时报错" —— 用失败换安全，这笔交易永远划算
6. 文件尾部有 `-- Dump completed on 2026-09-30 20:46:48` 时间戳，使文件**不可复现**：重跑同一条命令内容就变了，checksum 必然改变

修正后已在临时库 `easychat_verify` 端到端执行 V1 + V2 验证通过：10 张表、`revoke_user_id` 为 `varchar(12)`、`uk_client_msg_id` 唯一索引 `non_unique=0`；验证库已删除。

### 3.4 能力评级

**本课评级：L3（能独立完成，且能主动解释取舍与风险）**

依据不是"完成了任务"，而是**多次主动做出超出要求且方向正确的判断，并给出理由**：选临时库验证而非直接改真库（风险意识）、用 `--result-file` 规避编码问题并解释原因（踩坑经验）、加 `clean-disabled`（防御性设计）、产出完整实施文档（工程习惯）。

⚠️ 但有一处未达顶格：V1 残留 `DROP TABLE` 说明**对"生成的产物"缺少逐项审视** —— 建议里给了 `--skip-add-drop-table`，实际执行的命令里却没有，两者之间的差异没有被核对。

**下一步该练的**：拿到任何生成物（dump、代码生成、脚手架）之后，先完整读一遍再说"完成"。生成工具的默认行为里藏着最多的意外。

### 3.5 本课遗留

- `easychat` 正式库尚未迁移 —— 下次以 local 启动时 Flyway 才会建基线并执行 V2，需在启动后确认
- `target/classes/db/migration/` 下仍是旧副本，**启动前必须重新编译**（`mvn compile` 或 IDE Rebuild），否则 Flyway 读到的是旧 V2
- V1 中保留了三处 `AUTO_INCREMENT=1698 / 136893 / 11`（本机开发库的自增计数器），属低优先级瑕疵：新环境的起始 ID 会沿用旧值。登记为技术债
- 已确认 `src/main/resources` 下的 `.sql` 不受 Spring Boot parent 的资源过滤影响，checksum 稳定，无需额外处理

---

## 第 4 课｜M1-R1 客户端幂等 ID

### 4.1 讲了什么

- 幂等键模式：为什么自增主键做不了幂等（`<selectKey order="AFTER">` 的 ID 在 INSERT 成功后才存在，发送前客户端拿不到，**幂等键必须由发起方先行持有**）
- 幂等三语义（首次插入 / 重复返回既有 / 空值退化）与"查重必须放在方法最前面"
- 为什么"查重 + 唯一索引"要同时存在（乐观查重负责常规路径，唯一约束负责并发兜底）
- `DuplicateKeyException` 必须在 Service 捕获转成"查询后返回"，且回查为空时必须 rethrow
- 参考片段已写入 `DESIGN_DETAIL.md` 第 4 章「参考示范」

### 4.2 本课最有价值的一段：用户三轮追问"幂等键怎么保证同一性"

用户提问：「`crypto.randomUUID()` 怎么就能保证幂等？快速点击发送，同一条内容产生的 UUID 不还是两个吗？」

**这是本课真正的分水岭，也是我表述不严谨引发的一次高质量追问。** 澄清链条：

1. **幂等 ≠ 内容去重**。幂等的主语是"同一个幂等键"，不是"同一段内容"。双击 = 两个 UUID = 两个独立操作 = 落两行，这是**正确行为**。
2. `randomUUID` 只提供**唯一性**，"同一性"是**客户端代码**给的——UUID 只在构造消息对象时生成一次，之后所有重试复用该对象。分界线：**用户主动发起新操作 → 新 UUID；基础设施自动重试同一操作 → 复用 UUID**。
3. 追问二："状态锁会不会阻塞用户连续发不同消息？" —— 会，如果锁的是输入框。正确粒度是锁"一次提交动作"，而它结束的标志**不是落库**，是消息对象构造完成。
4. 追问三："清空提前，失败了怎么办？" —— **用户的质疑救了这个建议**。当前架构下消息内容只有 `msgContent` 一个副本，提前清空 = 失败即丢内容。微信"红叹号 + 点击重试"的前提是消息**先成为独立对象**（带内容副本、`clientMessageId`、状态）存在本地。正确顺序是四条一组：构造消息对象 → 立即渲染进列表（发送中）→ 清空输入框 → 异步发送。
5. **闭环**：没有幂等键，"点击重试"这个功能根本做不出来——第一次请求可能已成功只是响应丢了，重试就会产生第二条。幂等键不是为防手抖，是**为重试机制铺路**。

这一串追问全部属于 M1-R3 的设计范畴，作为伏笔足够，M1-R1 阶段输入框清空时机一行不动。

### 4.3 我自己的判断失误（三处，均已在对话中收回）

1. **把"用户真想连发两条一样的内容"当成需求举例** —— 把话题带偏了。真正要紧的是"系统分辨不出"，不是"用户想这么做"。
2. **建议"把清空输入框提前"** —— 在消息尚未成为独立对象的架构下，这会导致失败即丢内容。撤回。
3. **说 `cleanMsgContent` 改完后就多余** —— 用户用 `uploadFileDo` 传 `false`（[MessageSend.vue#L283](file:///c:/Users/Administrator/easy-chat/src/renderer/src/views/chat/MessageSend.vue#L283)）反驳，成立。该参数区分"文本消息内容来自输入框，需清"与"文件消息内容不来自输入框，不需清"。我的结论搭在错误前提上，前提撤回后结论自动作废。
4. **准备批 `REQUIRES_NEW` 是过度设计，推演后自我更正** —— 该注解当前确实无功能差异，但它把"幂等回查必须在干净事务中执行"这一约束固化了下来。**该改的是注释（"保证原子性"是错的理由），不是注解。**

### 4.4 用户作业 review（超出 M1-R1 范围，含 R2/R3 内容）

**必修**

1. **幂等预检位置错误**（[ChatMessageServiceImpl.java#L187-L195](file:///c:/Users/Administrator/easy-chat-java/src/main/java/com/easychat/service/impl/ChatMessageServiceImpl.java#L187-L195)）—— 被放在联系人校验（L142-157）与 messageType 校验（L173-176）之后，违反设计约定。暴露路径：首次发送成功后对端删好友 → 重试同一 `clientMessageId` → L142 读到 Redis 中已消失的联系人 → 抛 `CODE_902`。且该校验读 Redis 而非 DB，缓存抖动期格外脆。**修法：整段移到方法体第一行。**
2. **`clientMessageId != null` 应为 `!StringTools.isEmpty(...)`**（L189、L205）—— 空串会被当成有效幂等键，导致无关消息互相判重；库中存在多个空串时 `selectOne` 抛 `TooManyResultsException`。附带原理：**InnoDB 唯一索引允许多个 `NULL` 共存，但不允许多个空串**，故"不传"必须落 `NULL`。

**肯定**

- Controller 加 `@Size(max = 64)`（超出参考答案，与 DB `varchar(64)` 对齐，边界校验前置）
- `self` + `@Lazy` 自注入规避 Spring AOP 自调用失效
- Mapper XML 四处改动一处不落，尤其 `base_result_map` 那行——漏了不报错、字段静默为 `null`
- 前端 `params` 确实带上 `clientMessageId`（漏这一环则后端改造全空转）
- `updateStatusByMessageIdAndStatus` 用条件更新做 CAS、按影响行数判胜负，做法标准

**待核对**：L331 `messageSendDto.setFileType(MessageTypeEnum.FILE_UPLOAD.getType())` 语义混用（把消息类型塞进文件类型字段），无法确认是否为原有代码。

**已知的洞（不修，留待 R4）**：幂等命中分支直接 return 不重新推送，故"insert 成功但推送失败"时重试不会补推送。正式解法是 M1-R4 增量补偿（接收方按 `messageId` 游标主动拉），这也解释了为什么 M1 后还有 R4、R5。

### 4.5 能力评级

**本课评级：L2（可独立完成，但需要关键提示）**

依据：全部改造点一处不落、线路全通（PO / DTO / XML / 接口 / Service / Controller / 前端），并主动超出范围做了文件上传的 CAS 幂等，说明工程执行力已经到了。**但两处必修都落在"设计意图"层面而非"语法实现"层面**——查重位置和 `!= null` 都是"照做了动作，但没想透这个动作为什么必须在那个位置"。这恰好是 L2 与 L3 的分界线：L3 是能主动解释取舍，而不只是完成清单。

相比之下第 3 课（M0-3）是 L3，本课回落到 L2，**不是退步**：M0-3 是工程流程题，本课是设计语义题，难点类型不同。

**下一步该练的**：写每一行代码前先问一句"这个判断为什么必须放在**这里**、放在前后一行会怎样"。位置本身就是设计的一部分。

### 4.6 本课遗留

- 两处必修待修正 + 四项验收待跑（Postman 同 ID 连发 3 次；**重启后端**拿旧 ID 再发一次，验证幂等落在数据库而非内存）
- `updateStatusByMessageIdAndStatus` / `saveMessageFile` CAS 闸门属 M1-R2/R3 范围，其完整设计需等 ACK 机制确定（如"上传失败是否回退状态"尚无答案）
- 前端 `cleanMsgContent` 参数与输入框清空时机的重构，归 M1-R3

---

## 待办与衔接

- **下一课**：M1-R2 下行 ACK（消息状态机：已入库 / 已送达 / 已读）
- **跨课线索**：白名单静默失败风险 → M2 新增 4 个接口时必须逐条核对注解
- **跨课线索**：OpenAPI 契约 → M3 TypeScript 自动生成前端类型
- **跨课线索**：本课"静默失效的 gitignore 规则" → 与第 1 课"白名单漏标注解"同属**会静默失败的设计**，是贯穿全程的识别模式