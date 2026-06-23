# CLAUDE.md — pstep-engine 项目指南

> 本文件供 Claude Code 读取，确保施工规范一致。

---

## 项目概述

pstep-engine 是一个 **Plan/Solve/Verify 范式的 AI Agent 引擎**，支持：
- 飞书机器人频道（WSClient 长连接 + 卡片流式输出）
- HTTP API 频道（Fastify + SSE 流式输出）
- 项目规则引擎（按项目注入自定义 system prompt）
- SQLite 持久化（项目、会话、消息、规则）

核心依赖：`@earendil-works/pi-agent-core`（Agent 框架）、`@larksuiteoapi/node-sdk`（飞书 SDK）

---

## 目录结构

```
src/
├── app.ts                        # 应用入口，启动 HTTP 服务 + 飞书频道
├── index.ts                      # 包导出入口
├── agent/
│   ├── orchestrator.ts           # Agent 编排器：构建 Agent、订阅事件、流式 yield
│   ├── plan-solve-loop.ts        # Plan/Solve/Verify 循环控制器
│   ├── sub-agent.ts              # 子代理管理器（并行步骤执行）
│   └── message-converter.ts      # 消息格式转换
├── engine/
│   └── index.ts                  # PstepEngine：封装 Orchestrator + 规则引擎
├── server/
│   └── index.ts                  # Fastify HTTP 服务器 + REST API
├── db/
│   ├── connection.ts             # SQLite 连接管理（better-sqlite3）
│   ├── dao.ts                    # 数据访问对象（ProjectDao, SessionDao, MessageDao）
│   └── index.ts                  # DB 导出
├── channels/
│   └── feishu/
│       ├── client.ts             # 飞书 SDK 封装：WSClient、sendCard、patchCard
│       ├── card-streamer.ts      # 卡片流式输出：节流 PATCH、body 截断
│       ├── card-templates.ts     # 卡片 JSON 模板（thinking/streaming/final/error）
│       ├── message-router.ts     # 消息路由：mention 过滤 → session → adapter → streamer
│       ├── session-mapper.ts     # sessionId 生成：chatId:senderOpenId
│       ├── mention-filter.ts     # 群聊 @机器人 过滤
│       ├── types.ts              # 飞书频道类型定义
│       └── index.ts              # 飞书频道导出
├── rules/
│   ├── rule-engine.ts            # 规则引擎：按项目合并规则到 system prompt
│   └── index.ts
├── tools/
│   ├── plan-executor.ts          # Plan 步骤执行器
│   ├── solve-executor.ts         # Solve 步骤执行器
│   ├── verify-executor.ts        # Verify 步骤执行器
│   └── index.ts
└── types/
    ├── messages.ts               # PstepMessage 类型定义
    ├── rules.ts                  # 规则类型定义
    └── index.ts
```

---

## 模块划分

### 1. pstep-engine 核心模块

**位置**：`src/agent/`, `src/engine/`, `src/server/`, `src/db/`, `src/rules/`, `src/tools/`

**职责**：
- Agent 生命周期管理（Orchestrator 创建/销毁 Agent 实例）
- Plan/Solve/Verify 循环控制（PlanSolveLoop）
- LLM 调用（通过 pi-agent-core 的 Agent 类）
- HTTP API 服务（Fastify）
- 数据库持久化（SQLite）

**关键文件**：
- [orchestrator.ts](src/agent/orchestrator.ts) — 每次 `execute()` 创建新 Agent，`messages: []`
- [plan-solve-loop.ts](src/agent/plan-solve-loop.ts) — PSV 循环，`maxIterations` 控制最大轮次
- [engine/index.ts](src/engine/index.ts) — 封装 Orchestrator + 规则引擎

### 2. 飞书频道模块

**位置**：`src/channels/feishu/`

**职责**：
- 飞书 SDK 对接（WSClient 长连接）
- 卡片渲染（thinking → streaming → final）
- 消息路由（mention 过滤 → session 映射 → engine 适配）
- 流式输出节流（CardStreamer）

**关键文件**：
- [client.ts](src/channels/feishu/client.ts) — 飞书 SDK 封装，WSClient 事件分发
- [card-streamer.ts](src/channels/feishu/card-streamer.ts) — 卡片 PATCH 节流、body 截断
- [message-router.ts](src/channels/feishu/message-router.ts) — 单条消息的完整生命周期

---

## 核心数据流

### 飞书消息处理链路

```
飞书 WSClient 事件
  → FeishuClient.start() handler
    → MessageRouter.handle(envelope)
      → filterMentions()        # 群聊是否 @机器人
      → SessionMapper.resolve() # 生成 sessionId (chatId:senderOpenId)
      → new CardStreamer()      # 创建卡片流式输出器
      → streamer.start()        # 发送 "思考中" 卡片
      → for await (engine.execute(text, projectId, sessionId))
           → PstepEngine.execute()
             → Orchestrator.execute()
               → new Agent(messages=[])   # 每次新建，无历史
               → agent.prompt(userMessage)
               → PlanSolveLoop 通过 agent.subscribe → turn_end 控制循环
      → streamer.push(msg)      # 实时更新卡片
      → streamer.finalize()     # 最终卡片（绿色 header + 步骤列表）
```

### HTTP API 处理链路

```
POST /api/chat { projectId, message, stream: true }
  → Fastify SSE 响应
  → engine.execute(message, projectId, sessionId)
  → for await (msg) → rawSse(reply, 'message', JSON.stringify(msg))
  → MessageDao.create() 持久化每条消息
```

---

## 环境变量

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `GATEWAY_URL` | ✅ | `http://localhost:3001` | LLM Gateway 地址 |
| `GATEWAY_API_KEY` | — | — | Gateway API Key（如需要） |
| `FEISHU_APP_ID` | 飞书频道 | — | 飞书应用 App ID |
| `FEISHU_APP_SECRET` | 飞书频道 | — | 飞书应用 App Secret |
| `FEISHU_GROUP_MENTION_REQUIRED` | — | `true` | 群聊是否需要 @机器人 |
| `FEISHU_CARD_FLUSH_MS` | — | `200` | 卡片 PATCH 最小间隔（ms） |
| `FEISHU_CARD_MAX_BYTES` | — | `25000` | 卡片 body 最大字节数 |
| `FEISHU_DEBUG` | — | `false` | 飞书频道调试日志 |
| `FEISHU_CHAT_PROJECT_MAP` | — | — | chatId → projectId 映射（JSON） |
| `PSTEP_DB_PATH` | — | `./data/pstep.db` | SQLite 数据库路径 |
| `LLM_MAX_TOKENS` | — | `4096` | LLM 单次输出最大 token 数 |
| `LLM_MAX_ITERATIONS` | — | `10` | PlanSolveLoop 最大迭代轮次 |
| `NODE_ENV` | — | `development` | 运行环境 |

---

## 构建与部署

### 本地开发

```bash
# 安装依赖
npm install

# 构建
npm run build        # tsc 编译到 dist/

# 开发模式（监听文件变化）
npm run dev          # tsc --watch

# 运行
npm start            # node dist/app.js

# 测试
npm test             # vitest run
```

### CI/CD 流程（GitHub Actions）

**触发条件**：push 到 `main` 分支，且 `src/`、`package.json`、`tsconfig.json` 有变化

**流程**：
1. **build job**（ubuntu runner）：`npm ci` → `npm run build` → 打包 tarball（排除 node_modules）
2. **deploy job**：scp tarball 到服务器 → 解压 → `npm install` → `npm run build` → `systemctl restart`

**部署目标**：
- 服务器：`134.175.163.213`
- 部署目录：`/opt/pstep/engine`
- 服务名：`pstep-engine`

**⚠️ 重要：禁止手动部署！**
- **不要** 用 `scp` 或 `tar` 手动上传代码到服务器
- **必须** 通过 git push → CI/CD 自动部署
- 手动部署会导致 node_modules 版本不兼容（本地编译 vs 服务器 Node.js 版本）

### 部署验证

```bash
# 检查服务状态
ssh root@134.175.163.213 "sudo systemctl status pstep-engine"

# 检查日志
ssh root@134.175.163.213 "sudo journalctl -u pstep-engine -n 50 --no-pager"

# 健康检查
curl http://134.175.163.213:4000/health
```

---

## 服务器环境

### 服务配置

```ini
# /etc/systemd/system/pstep-engine.service
[Unit]
Description=Pstep Engine Agent Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node dist/app.js
WorkingDirectory=/opt/pstep/engine
EnvironmentFile=/etc/pstep-engine/env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 环境变量文件

```
# /etc/pstep-engine/env
GATEWAY_URL=http://127.0.0.1:3002
PSTEP_DB_PATH=/var/lib/pstep-engine/data/pstep.db
NODE_ENV=production
GATEWAY_API_KEY=<your-gateway-api-key>
FEISHU_APP_ID=<your-feishu-app-id>
FEISHU_APP_SECRET=<your-feishu-app-secret>
FEISHU_GROUP_MENTION_REQUIRED=true
FEISHU_CARD_FLUSH_MS=200
FEISHU_DEBUG=true
```

---

## 已知问题与限制

### 1. 会话上下文丢失（待修复）

**现状**：每次飞书消息都创建新 Agent（`messages: []`），无历史上下文。
**影响**：多轮对话时，后续消息无法关联前文。
**根因**：`orchestrator.ts` 每次 `execute()` 都 `new Agent({ messages: [] })`。
**修复方向**：从 MessageDao 加载历史消息，或维护 Agent 实例生命周期。

### 2. 无整体执行超时

**现状**：Agent 的 AbortController 从未被调用，LLM 调用或工具执行可无限挂起。
**影响**：极端情况下请求永远不返回。
**修复方向**：添加 `Promise.race` 超时控制。

---

## 代码规范

- **语言**：TypeScript（ESM 模块，`"type": "module"`）
- **构建**：`npx tsc`（无打包工具）
- **测试**：Vitest
- **日志**：`console.log` + `[模块名]` 前缀（如 `[feishu]`、`[PstepEngine]`）
- **错误处理**：飞书卡片操作失败不崩溃，降级到日志记录
- **类型**：严格 TypeScript，避免 `any`（除飞书 SDK 交互外）

---

## 常见施工场景

### 修改飞书卡片显示

- 修改模板 → [card-templates.ts](src/channels/feishu/card-templates.ts)
- 修改流式输出逻辑 → [card-streamer.ts](src/channels/feishu/card-streamer.ts)
- 注意：飞书 PATCH 限制 ~30KB，body 截断逻辑在 `truncate()` 方法

### 修改 Agent 行为

- 修改 PSV 循环 → [plan-solve-loop.ts](src/agent/plan-solve-loop.ts)
- 修改 Agent 创建 → [orchestrator.ts](src/agent/orchestrator.ts)
- 修改系统提示词 → [orchestrator.ts](src/agent/orchestrator.ts) `buildSystemPrompt()`

### 添加新的频道

- 参考 `src/channels/feishu/` 结构
- 实现 `EngineAdapter` 接口（`execute(text, projectId, sessionId)`）
- 在 `app.ts` 中注册新频道

### 修改数据库

- Schema 定义 → [db/connection.ts](src/db/connection.ts)
- DAO 层 → [db/dao.ts](src/db/dao.ts)
- 注意：SQLite 是 embedded 数据库，无需独立服务
