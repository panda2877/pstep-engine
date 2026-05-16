# Pstep Engine

> Pstep 自定义 Agent 逻辑引擎

基于 pi-agent-core + pi-ai 构建的自定义消息类型、工具、Agent 钩子

## 架构

```
pstep-web (5173)
    ↓ HTTP (SSE)
pstep-engine (4000) — Agent 逻辑引擎
    ↓ HTTP (OpenAI 兼容)
pstep-gateway (3001) — 模型网关
    ↓
OpenAI / MiMo / 其他上游 API
```

## 模块结构

```
src/
├── types/          # 类型定义
│   ├── messages.ts # Plan/Solve/Verify 消息类型
│   └── rules.ts    # 规则引擎数据模型
├── db/             # 数据库层
│   ├── index.ts    # SQLite 管理器
│   └── dao.ts      # 数据访问对象
├── server/         # HTTP 服务器
│   └── index.ts    # Fastify 服务器 + API 路由
├── engine/         # Agent 引擎（待实现）
└── index.ts        # 主入口
```

## 依赖

- `@panda2877/pi-agent-core` — Agent 运行时
- `@panda2877/pi-ai` — LLM 抽象层
- `fastify` — HTTP 服务器框架
- `fastify-sse-v2` — SSE 流式响应
- `better-sqlite3` — SQLite 数据库

## 开发

```bash
npm install
npm run build
npm test
```

## 部署

通过 GitHub Actions 自动部署到服务器 `/opt/pstep/engine/`

## 发布

```bash
npm version patch  # 或 minor / major
git push && git push --tags
npm publish
```
