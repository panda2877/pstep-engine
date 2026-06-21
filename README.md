# pstep-engine

基于 [pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai) 和 [pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core) 构建的 Agent 引擎服务。

支持 HTTP API、飞书 / Lark 渠道、Plan/Solve/Verify 多步推理、项目规则系统。

---

## 功能

- **HTTP 服务** — Fastify，提供 `/api/chat`（SSE 流式）、`/api/projects`、`/api/sessions`
- **飞书渠道** — WebSocket 长连接，自动收发消息，流式卡片实时更新
- **Plan/Solve/Verify 循环** — 多步推理、子代理 DAG 调度
- **规则引擎** — 按项目注入 XML 格式化规则到 systemPrompt
- **SQLite 持久化** — 项目、规则、会话、消息

---

## 快速开始

### 安装

```bash
npm install pstep-engine
# 或
git clone https://github.com/panda2877/pstep-engine.git
cd pstep-engine
npm install
npm run build
```

### 配置环境变量

```bash
# LLM 网关
export GATEWAY_URL="http://134.175.163.213:3001/v1/messages"  # 你的网关地址

# 飞书渠道（可选，不设置则跳过）
export FEISHU_APP_ID="cli_xxxxxxxx"
export FEISHU_APP_SECRET="your_app_secret_here"
```

### 启动

```bash
# 启动 HTTP 服务（端口 4000）
npm start

# 或
node dist/app.js
```

### 验证

```bash
# 健康检查
curl http://localhost:4000/health

# 创建项目
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"test","description":"测试项目"}'
```

---

## 飞书渠道

飞书渠道使用 **WebSocket 长连接**，无需公网 IP，适合内网部署。

### 配置步骤

1. **创建自建应用**：访问 [飞书开放平台](https://open.feishu.cn/app) → 创建企业自建应用

2. **配置权限**（应用 → 权限管理）：

   | 权限 | 说明 | 必需 |
   |------|------|------|
   | `im:message.group_at_msg:readonly` | 接收群聊 @bot 消息 | ✅ |
   | `im:message.p2p_msg:readonly` | 接收私聊消息 | ✅ |
   | `im:message:send_as_bot` | 发送消息（旧） | ✅ |
   | `im:message:send` | 发送消息（新） | ✅ 同时申请 |
   | `im:message:update` | 更新消息（卡片流式刷新） | ✅ |

3. **配置事件订阅**（应用 → 事件订阅）：
   - 接收方式：**长连接接收**
   - 添加事件：`im.message.receive_v1`（接收消息）

4. **设置环境变量**：

   ```bash
   export FEISHU_APP_ID="cli_xxxxxxxx"
   export FEISHU_APP_SECRET="your_app_secret_here"

   # 可选
   export FEISHU_GROUP_MENTION_REQUIRED=true   # 群聊是否要求 @bot（默认 true）
   export FEISHU_CHAT_PROJECT_MAP="chatId1:p1,chatId2:p2"  # 静态项目映射
   export FEISHU_CARD_FLUSH_MS=200              # 流式卡片 PATCH 节流间隔（ms）
   export FEISHU_CARD_MAX_BYTES=25000           # 卡片内容软上限（bytes）
   export FEISHU_DEBUG=true                     # 调试日志
   ```

5. **启动服务**：

   ```bash
   npm start
   # [Feishu] channel up (group mention required: true, flush 200ms)
   ```

### 路由规则

| 场景 | 行为 |
|------|------|
| 私聊 (DM) | 始终响应 |
| 群聊 + @bot | 响应，@提及被自动清洗 |
| 群聊 + @_all | 响应（全员消息） |
| 群聊 + 未 @bot | 静默，不消耗 token |

### 卡片生命周期

```
用户发消息
  ↓
[🧠 思考中…] ← 发送初始卡片
  ↓ (streaming tokens)
[✨ 生成中] ← 实时 PATCH 更新（节流 200ms + 429 退避）
  ↓ (plan/solve/verify/tool_call/tool_result 事件)
  ↓ (done)
[✅ 完成] ← 最终 PATCH（绿色 header + summary + 折叠步骤）
```

### Session 映射

默认行为：`chat_id → projectId = "feishu:<chat_id>"`，同 chat 所有用户共享一个 project（共享规则库）。

用户隔离：`sessionId = "<chatId>:<senderOpenId>"`，每个用户独立对话历史。

自定义映射：`FEISHU_CHAT_PROJECT_MAP="oc_xxx:p_yyy,oc_aaa:p_bbb"`

---

## HTTP API

### `GET /health`

```json
{"status":"ok","version":"0.1.0","timestamp":1782050055219}
```

### `POST /api/projects`

```json
{"name":"test","description":"项目描述"}
→ {"id":"uuid","name":"test","status":"created"}
```

### `GET /api/projects/:id`

→ `{id, name, description, status}`

### `PUT /api/projects/:id/rules`

```json
{"category":"code_style","content":"使用 TypeScript strict mode","priority":10}
→ {"status":"created","rule":{...}}
```

### `POST /api/sessions`

```json
{"projectId":"xxx","title":"对话标题"}
→ {"id":"uuid","projectId":"xxx","status":"created"}
```

### `POST /api/chat`（SSE 流式）

```json
{
  "projectId": "xxx",
  "message": "帮我写一个 hello world",
  "stream": true
}
```

SSE 事件流：
- `event: message` — `{type:"plan"|"streaming"|"solve"|"verify"|"tool_call"|"tool_result"|"done", ...}`
- `event: done` — `{type:"done", sessionId, ...}`
- `event: error` — `{type:"error", message}`

---

## 项目结构

```
src/
├── app.ts                      入口（HTTP + 飞书）
├── index.ts                    入口（同 app.ts）
├── server/
│   └── index.ts                Fastify HTTP 服务器
├── engine/
│   └── index.ts                PstepEngine（Plan/Solve/Verify 循环）
├── agent/
│   ├── orchestrator.ts         Agent 编排（pi-agent-core 封装）
│   ├── plan-solve-loop.ts      Plan/Solve/Verify 循环
│   ├── sub-agent.ts            子代理 DAG 调度
│   └── message-converter.ts    LLM 消息转换
├── rules/
│   └── rule-engine.ts          规则引擎（XML 格式化 + systemPrompt 注入）
├── db/
│   ├── connection.ts           SQLite 连接管理
│   └── dao.ts                  ProjectDao / SessionDao / MessageDao
├── tools/
│   ├── plan-executor.ts        Plan 工具
│   ├── solve-executor.ts       Solve 工具
│   └── verify-executor.ts      Verify 工具
├── types/
│   ├── messages.ts             PstepMessage 联合类型
│   ├── streaming-message.ts    StreamingMessage
│   └── rules.ts                规则类型
└── channels/
    └── feishu/
        ├── index.ts             导出入口
        ├── client.ts            FeishuClient（WSClient + SDK 包装）
        ├── message-router.ts    事件路由 → 引擎 → 卡片
        ├── card-streamer.ts     流式卡片（节流 + 退避 + 25KB 折叠）
        ├── mention-filter.ts    @提及判定 + 文本清洗
        ├── session-mapper.ts    chatId → projectId/sessionId
        ├── card-templates.ts    Card 2.0 JSON 模板工厂
        ├── types.ts             内部类型
        └── __tests__/
            ├── mention-filter.test.ts   10 tests
            ├── card-streamer.test.ts    10 tests
            └── message-router.test.ts   7 tests
```

---

## 开发

```bash
# 安装依赖
npm install

# 编译
npm run build

# 开发模式（watch）
npm run dev

# 运行测试（27 个飞书相关单元测试）
npm test
```

---

## 环境变量

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `GATEWAY_URL` | 是 | LLM 网关地址 | `http://localhost:3001` |
| `FEISHU_APP_ID` | 否* | 飞书自建应用 App ID | — |
| `FEISHU_APP_SECRET` | 否* | 飞书自建应用 App Secret | — |
| `FEISHU_GROUP_MENTION_REQUIRED` | 否 | 群聊是否要求 @bot | `true` |
| `FEISHU_CHAT_PROJECT_MAP` | 否 | 静态项目映射 | — |
| `FEISHU_CARD_FLUSH_MS` | 否 | 流式卡片 PATCH 节流间隔（ms） | `200` |
| `FEISHU_CARD_MAX_BYTES` | 否 | 卡片内容软上限（bytes） | `25000` |
| `FEISHU_DEBUG` | 否 | 调试日志 | `false` |
| `PSTEP_DB_PATH` | 否 | SQLite 数据库路径 | `./data/pstep.db` |
| `NODE_ENV` | 否 | 运行模式 | `development` |

*飞书渠道仅在同时设置 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 时启动。

---

## License

MIT
