# EasyChat 完善功能计划书

> 排序原则：**消息可靠性优先** → 功能补全 → 工程化 / 生产化
> 涉及仓库：前端 `easy-chat`（Electron + Vue3）、后端 `easy-chat-java`（Spring Boot 3.2 + Netty）
> **配套文档：[DESIGN_DETAIL.md](./DESIGN_DETAIL.md)** —— 把本文每个任务拆到可直接动手写代码的精度（现状代码位置 / 接口契约 / 验收 / 常见坑）

---

## 协作模式（重要）

本项目后续**所有计划的实现，目的都是带你一起提升代码能力与工程能力**，把 skill 锤炼到 mid / senior 级别。

因此：

- **不直接快速生成全部代码**，而是按 [DESIGN_DETAIL.md](./DESIGN_DETAIL.md) 的模块**逐个推进**
- 每个模块：先讲清"为什么这么做"（含替代方案与权衡）→ 你动手写 → 一起 review
- 关键代码留白，由你实现；卡住时再看"实现提示"
- 每步结束用 DESIGN_DETAIL 附录 B 的 10 条审查清单自检

---

## 阶段总览

| 阶段 | 主题 | 核心产出 | 依赖 |
| --- | --- | --- | --- |
| **M0** | 基线准备 | 接口文档、配置外置、DDL 变更、健康检查 | 无 |
| **M1** | **消息可靠性（P0）** | 幂等 ID、ACK、重发队列、增量补偿、去重 | M0 |
| **M2** | 功能补全（P1） | 撤回/删除、引用+@、转发、搜索 | M0 |
| **M3** | 工程化与生产化（P2） | TypeScript、单测、限流/敏感词、监控、容器化 | M1 |

---

## 一、现状实证问题（可靠性专项）

全部有代码出处，作为 M1 的依据。

| # | 问题 | 代码证据 | 后果 |
| --- | --- | --- | --- |
| 1 | **消息无客户端 ID**，`messageId` 靠 `SELECT LAST_INSERT_ID()` 生成 | `ChatMessageMapper.xml` insert 节点 | 客户端发送前无唯一标识，**无法幂等**，超时重发必产生重复消息 |
| 2 | **下行无 ACK**，`channel == null` 时静默 return | `ChannelContextUtils#sendMsg` | 对端离线即丢弃，发送方无从感知"是否送达" |
| 3 | **离线补偿是全量时间窗拉取**，上限 3 天，且**每次重连都重跑** | `ChannelContextUtils#addContext` | 重连一次拉 3 天消息；超过 3 天的消息永久丢失；无游标 |
| 4 | **前端无发送重试 / 待发队列**，失败仅弹框 | `MessageSend.vue#sendMessageDo` | 网络抖动即丢消息，用户需手动重发 |
| 5 | **本地插入未做幂等**，重连 init 重复写同一 `message_id` | `db/ChatMessageModel.js` | 本地表主键为 `(user_id, message_id)`，重复写会**抛主键冲突错误**（而非静默重复）；且 `message_id` 允许 NULL，多条"发送中"消息可共存 |
| 6 | 重连逻辑 `lockReconnect` 与 `ws.close()` 顺序可疑，超 5 次即永久放弃 | `main/wsClient.js#reconnet` | 弱网环境下连接不可恢复 |

**已有亮点（无需重做）**：后端已采用 **Redisson RTopic 广播 + 各节点本地 Channel 查找**（`MessageHandler`），该模型天然支持多节点横向扩展。

---

## 二、M0 基线准备

| 任务 | 内容 | 产出 |
| --- | --- | --- |
| M0-1 接口文档 | 引入 `springdoc-openapi` + `knife4j-openapi3-jakarta-spring-boot-starter`，为 6 个 Controller 补充注解 | 可访问 `/doc.html` 在线联调 |
| M0-2 配置外置 | `spring.datasource.password`、`project.folder`（当前硬编码 `C:/Administrator/...`）改为环境变量占位 | 新增 `application-dev.properties`，敏感项走环境变量 |
| M0-3 DDL 变更 | 引入 Flyway 管理迁移；新增字段与索引 | `easy-chat-java/src/main/resources/db/migration/`（V1 baseline + V2 reliability） |
| M0-4 健康检查 | `spring-boot-starter-actuator`，暴露 `/actuator/health` | 部署前可探活 |

### M0-3 数据库变更清单

见 `easy-chat-java/src/main/resources/db/migration/V2__reliability.sql`（由 Flyway 自动执行，非手工执行）。核心变更：

- `chat_message` 新增：`client_message_id`、`quote_message_id`、`at_user_ids`、`revoke_time`、`revoke_user_id`
- 唯一索引：`uk_client_msg_id(client_message_id)`
- 查询索引：`idx_contact_sendtime(contact_id, send_time)`、`idx_session_msgid(session_id, message_id)`

**验收**：Swagger 可打开并成功调用 `/api/account/login`；后端使用环境变量启动成功。

---

## 三、M1 消息可靠性（核心阶段）

### R1 — 客户端幂等 ID

- **前端**：发送前生成 `clientMsgId = UUID`，随 HTTP 与 WS 一同携带
- **后端**：`ChatMessage` 增 `clientMessageId`；`saveMessage` 入口先按 `client_message_id` 查重，命中则直接返回已存在记录
- **收益**：彻底解决"超时重发产生重复消息"

### R2 — 下行 ACK

- **协议**：接收端收到 `CHAT / MEDIA_CHAT` 后回发 `{"type":"ACK","clientMsgId":"..."}`
- **后端**：`HandlerWebSocket` 解析 ACK，写入 `redis: msg:ack:{senderId}`
- **前端**：发送方消息气泡增加状态机 `发送中 → 已送达 → 已读`；**已读仅单聊实现**，群聊只保留未读数（决策见第九节）

### R3 — 本地待发队列 + 重试

- **DB**：本地 SQLite 新增 `pending_message` 表（`client_msg_id` 主键、`payload`、`retry_count`、`next_retry_at`）
- **流程**：发送前先落本地（UI 立即渲染"发送中"）→ HTTP 成功即标记完成 → 失败进队列，指数退避（1s/2s/4s/8s，上限 5 次）→ App 重启自动恢复
- **收益**：网络抖动不再丢消息

### R4 — 增量补偿游标

- **后端**：`addContext` 中补偿查询由 `send_time > lastOffTime` 改为 `message_id > lastOffMessageId`（登录后写入 Redis），仅拉增量
- **前端**：本地表加 `UNIQUE(session_id, message_id)`，写入使用 `INSERT OR IGNORE` 去重
- **前端**：重连成功后主动请求一次增量同步
- **收益**：重连不再全量拉 3 天；超 3 天的消息也能补齐；重复写入被约束拦截

### R5 — 重连健壮性修复

- 修复 `lockReconnect` / `ws.close()` 时序
- 重试次数改为**无限重试 + 指数退避**（上限 30s），仅在 `closeWs()` 主动退出时停止

### M1 验收标准

1. 断网发送 3 条消息 → 恢复网络 → 自动补发，对端仅收到 1 份
2. 双方同时在线互发 100 条 → 无丢失、无重复、顺序正确
3. 关闭客户端 10 分钟后重开 → 断线期间消息完整补齐
4. 重连耗时 < 5s，且不再触发全量拉取

---

## 四、M2 IM 功能补全

| 编号 | 功能 | 后端 | 前端 | DB |
| --- | --- | --- | --- | --- |
| **F1** | 消息撤回 | 新增 `MessageTypeEnum.REVOKE(15)`（14 已被 ACK 占用，见 DESIGN_DETAIL 0.1）；`/chat/revokeMessage`（校验发送者 + **统一 2 分钟**窗口） | 右键菜单 → 气泡替换为"你撤回了一条消息" | `revoke_time`、`revoke_user_id` |
| **F2** | 消息删除（**仅删本地**） | `/chat/deleteMessage`，仅写用户维度删除记录，不改消息本体 | 右键删除；会话内多选批量删除 | 新表 `chat_message_delete(user_id, message_id)` |
| **F3** | 引用回复 + @提醒 | `/chat/sendMessage` 扩展 `quoteMessageId`、`atUserIds`；被 @ 用户 `no_read_at_count + 1` | 引用条 UI、@ 成员选择器、被 @ 红点独立样式 | `quote_message_id`、`at_user_ids`、`chat_session_user.no_read_at_count` |
| **F4** | 消息转发 | `/chat/forwardMessage`（单条 / 合并多条，批量插入并可加附言） | 转发弹窗选择会话 | 复用 `chat_message` |
| **F5** | 消息搜索（**本地即时 + 服务端补全**） | `/chat/searchMessage`（关键词 + 会话/时间范围，MySQL `LIKE` 起步，预留 ES 接口） | 输入即搜本地 SQLite → 异步请求服务端 → 按 `message_id` 去重合并 → 结果高亮定位 | 查询索引；后续可上 `FULLTEXT` |

> **安全提醒（白名单鉴权）**：本项目鉴权由 AOP + `@GlobalInterceptor` 注解实现，属**白名单模式** —— 只有标注了该注解的方法才校验 token。因此**本阶段新增的 4 个接口（revokeMessage / deleteMessage / forwardMessage / searchMessage）漏加注解就等于公开裸奔，且无任何报错**。详见 DESIGN_DETAIL 第 1 章。

**依赖关系**：F1/F2 依赖 M0-3 的 DDL；F3 依赖 M1 的 `clientMsgId`。

**验收**：四项功能端到端可用；撤回后双方视图一致；@ 红点在群会话列表正确显示并可清零。

---

## 五、M3 工程化与生产化

| 方向 | 内容 |
| --- | --- |
| **TypeScript** | **渐进式、不动存量**：配好 `tsconfig` 但 `strict: false`，新增/改动文件强制 TS，存量 `.vue` 保持 JS |
| **管理端消息治理** | `/admin` 新增"消息治理"页，支持**不受时限强制撤回**任意消息（M2 只做用户侧 2 分钟撤回） |
| **单测** | 后端 JUnit5 + Mockito 覆盖 `ChatMessageServiceImpl`、`UserContactServiceImpl`；前端 Vitest 覆盖 `Utils` / `Verify` / `stores` |
| **安全** | Redis 令牌桶限流（登录、发消息、搜索）；敏感词 DFA 过滤；上传文件类型 + 大小 + 后缀白名单二次校验；登录失败 5 次锁定 15 分钟 |
| **监控** | 后端 Actuator + Micrometer/Prometheus（在线连接数、消息 TPS、推送失败率）；前端全局错误上报 |
| **部署** | `Dockerfile`（后端）+ `docker-compose.yml`（MySQL 8 / Redis / 后端），配置全走环境变量 |

---

## 六、风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 改动补偿逻辑影响登录首屏 | 高 | 保留旧逻辑开关（`im.compensate.mode=time\|cursor`），灰度切换 |
| DDL 变更需停机 | 中 | 全部为 `ADD COLUMN` + 建索引，MySQL 8 `ALGORITHM=INPLACE` 在线执行 |
| 本地 SQLite 加唯一约束 | 中 | 写迁移脚本：去重历史数据后再建约束 |
| TS 改造面大 | 中 | 只在新增/改动文件中强制，不阻塞 M1/M2 交付 |
| ACK 增加消息量 | 低 | ACK 走轻量帧，仅回 `clientMsgId`，服务端批量聚合写 Redis |

---

## 七、建议执行顺序

```
M0（1 个迭代，解除阻塞）
   ↓
M1（可靠性，P0）── R1 幂等 → R2 ACK → R3 待发队列 → R4 增量补偿 → R5 重连修复
   ↓
M2（功能，P1）── F1 撤回 → F2 删除 → F3 引用@ → F4 转发 → F5 搜索
   ↓
M3（工程化，P2）── TS / 单测 / 安全 / 监控 / 部署
```

每个子任务独立提交 + 独立验收，避免大爆炸式合并。

---

## 八、已确认的产品与技术决策

以下议题已逐项评审确认，实现时以此为准。

| # | 议题 | 决策 | 影响 |
| --- | --- | --- | --- |
| 1 | **消息删除语义** | **仅删本地**（微信同款）：只清理我方视图，对方仍可见 | F2 只写 `chat_message_delete`，不改消息本体；与 F1 撤回职责分离 |
| 2 | **已读回执范围** | **仅单聊做已读**；群聊保留现有未读数，不做已读 | R2 状态机仅单聊推进到"已读"；无需 `chat_message_read` 大表 |
| 3 | **撤回时限** | **统一 2 分钟**（单聊与群聊一致） | F1 后端校验 `now - send_time <= 120s`，阈值抽取为常量 |
| 4 | **消息搜索范围** | **本地即时 + 服务端补全** | F5 前端先查本地 SQLite，再异步请求服务端，按 `message_id` 去重合并 |
| 5 | **管理员强制撤回** | **做，但放到 M3**，不受时限限制 | M3 新增管理端"消息治理"页；M2 只做用户侧 2 分钟撤回 |
| 6 | **TypeScript 推进策略** | **渐进式，不动存量**：`tsconfig` 配好但 `strict: false`，新增/改动文件用 TS | M1/M2 不受影响，不引入类型报错风暴 |
| 7 | **ACK / 已读的 Redis 持久化** | **不持久化，可接受丢失** | Redis 重启仅影响"已读"标记推进，消息本体在 MySQL 不受影响；无需开 AOF |

---

## 九、后续评估项

| 事项 | 说明 |
| --- | --- |
| **多节点压测验证** | 现有 Redisson RTopic 广播 + 本地 Channel 查找模型已支持多节点；建议等 M1 增量补偿落地后再做压测，届时验证才有意义 |