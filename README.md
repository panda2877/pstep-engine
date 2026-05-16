# 🧠 Pstep Platform

> 基于 [pi Agent Framework](https://github.com/earendil-works/pi) 构建的 Pstep 多步推理平台
>
> 核心思想：将复杂任务拆解为 **Plan → Solve → Verify** 循环，让 AI 自主规划、执行、验证

---

## 📦 仓库一览

本平台由 **3 个 GitHub 仓库** 组成：

| # | 仓库 | 说明 | 技术栈 |
|---|------|------|--------|
| 1 | [`pstep-engine`](https://github.com/panda2877/pstep-engine) | **主仓库**：Agent 逻辑引擎 + CI/CD 编排 | TypeScript, pi-agent-core |
| 2 | [`pstep-gateway`](https://github.com/panda2877/pstep-gateway) | 模型网关：API Key 管理、路由分发、流式转发 | Node.js |
| 3 | [`pstep-web`](https://github.com/panda2877/pstep-web) | 自定义 UI 层：PlanPanel · SolveView · VerifyTimeline | TypeScript, pi-web-ui |

> 你正在看的就是 **主仓库（pstep-engine）** 👈

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         pstep-engine (主仓库)                        │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              Agent 逻辑引擎 (pi-agent-core + pi-ai)            │       │
│   │                                                              │       │
│   │   PlanMessage · SolveMessage · VerifyMessage                 │       │
│   │   PlanTool · SolveTool · VerifyTool                          │       │
│   │   beforeToolCall · afterToolCall · convertToLlm              │       │
│   │                                                              │       │
│   │   ┌──────────────────────────────────────────────────┐       │       │
│   │   │  pi-agent-core + pi-ai (npm 依赖)                  │       │       │
│   │   │  Agent 类 · AgentLoop · streamSimple               │       │       │
│   │   └──────────────────────────────────────────────────┘       │       │
│   └──────────────────────────┬──────────────────────────────────┘       │
│                              │                                         │
│                              ▼                                         │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │              pstep-web (UI 层，npm 依赖 pstep-engine)           │       │
│   │                                                              │       │
│   │   PlanPanel · SolveView · VerifyTimeline                     │       │
│   │   pi-web-ui 组件 (npm 依赖)                                    │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

                                    │ HTTP (OpenAI 兼容)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      pstep-gateway (独立服务)                       │
│                                                                         │
│   POST /v1/chat/completions                                             │
│       → 解析 model → 路由 → API Key 注入 → 转发上游                      │
│       → 流式 SSE 返回                                                    │
│                                                                         │
│   零依赖 pi，可被任何客户端使用                                           │
└─────────────────────────────────────────────────────────────────────────┘

                    │                    │                    │
                    ▼                    ▼                    ▼
             ┌──────────┐        ┌──────────┐        ┌──────────┐
             │ Anthropic │        │  OpenAI  │        │  其他    │
             └──────────┘        └──────────┘        └──────────┘
```

### 数据流

```
用户在 ChatPanel 输入问题
       │
       ▼
pstep-web 调用 Agent.prompt()
       │
       ▼
pstep-engine → convertToLlm() → 将 Plan/Solve/Verify 消息转为 LLM 格式
       │
       ▼
streamFn → pstep-gateway (HTTP /v1/chat/completions)
       │
       ▼
网关路由到上游 (Anthropic/OpenAI)
       │
       ▼
SSE 流式返回 → Agent 解析事件 → 工具调用 → Plan/Solve/Verify 循环
       │
       ▼
自定义渲染器将结果渲染到 UI
```

---

## 🔄 更新流程

### 日常开发

```bash
# 拉取最新代码
cd pstep-engine && git pull
cd pstep-gateway && git pull
cd pstep-web     && git pull

# 更新 npm 依赖（pi-agent-core / pi-ai 作为 npm 包管理）
cd pstep-engine
npm update @org/pi-agent-core @org/pi-ai

# 本地调试时用 npm link 串联仓库
cd pstep-engine && npm link
cd pstep-web    && npm link pstep-engine
```

### 更新 pi 框架版本

pi 框架通过 **npm 包** 引入，无需 fork 仓库：

```bash
cd pstep-engine
npm update @org/pi-agent-core @org/pi-ai

# 测试兼容性
npm test
```

---

## 🚀 发布流程

### 方式一：GitHub Actions 一键发布（推荐）

在 `pstep-engine` 仓库的 GitHub 页面：

1. 点击 **Actions** → **🚀 一键构建 + 部署**
2. 点击 **Run workflow**
3. 输入版本号（如 `1.0.0`）
4. 点击 **Run**

系统自动完成：
```
① pstep-engine 构建 → CI 发布 npm 包
② pstep-gateway 构建 → CI 部署
③ pstep-web 构建 → CI 部署
④ SSH 到服务器 → 备份旧版 → 部署新版 → 健康检查 ✅
```

### 方式二：手动发布

```bash
# 发布 pstep-engine
cd pstep-engine
npm version 1.0.0          # 自动更新 package.json + 打 tag
git push && git push --tags

# 发布 pstep-gateway
cd pstep-gateway
npm version 1.0.0
git push && git push --tags

# 发布 pstep-web
cd pstep-web
npm version 1.0.0
git push && git push --tags
```

### 版本号规范

遵循 [SemVer](https://semver.org/)：

```
主版本.次版本.修订号

1.0.0  ← 首次稳定发布
1.1.0  ← 新增功能（向后兼容）
1.1.1  ← Bug 修复
2.0.0  ← 不兼容的 API 变更
```

所有 3 个仓库保持**同一版本号**，确保部署时组件兼容。

---

## 🚀 部署

### 服务器架构

```
服务器
│
├── pstep-gateway (systemd 服务)
│   └── 端口 3001 — 模型 API 网关
│
├── pstep-engine (systemd 服务)
│   └── Agent 逻辑引擎，依赖 gateway
│
└── pstep-web (systemd 服务)
    └── 端口 5173 — 静态 UI，依赖 gateway
```

### 前提条件

- Node.js 16+
- systemd（CentOS 7+）
- 已配置的 GitHub Actions Secrets：
  - `SERVER_SSH_KEY` — SSH 私钥（base64 编码）
- 已配置的 GitHub Actions Variables：
  - `SERVER_HOST` — 服务器 IP 或域名
  - `SERVER_USER` — SSH 用户名（可选，默认 root）

### 首次部署

```bash
# 1. SSH 到服务器
ssh root@<your-server-ip>

# 2. 创建部署目录
mkdir -p /opt/pstep/{engine,gateway,web,scripts,backups}

# 3. 配置环境变量
cat > /etc/pstep-gateway/.env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
EOF

# 4. 创建 systemd 服务（见下方示例）

# 5. 在 GitHub 仓库 Settings → Secrets and Variables → Actions 中配置：
#    - Secrets: SERVER_SSH_KEY（base64 编码的 SSH 私钥）
#    - Variables: SERVER_HOST（你的服务器 IP）
```

### systemd 服务示例

**pstep-gateway.service:**
```ini
[Unit]
Description=Pstep Gateway - Model API Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pstep/gateway
ExecStart=/usr/local/bin/node /opt/pstep/gateway/dist/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pstep-gateway
MemoryLimit=200M

[Install]
WantedBy=multi-user.target
```

**pstep-engine.service:**
```ini
[Unit]
Description=Pstep Engine - Agent Logic Engine
After=network-online.target pstep-gateway.service
Wants=network-online.target
Requires=pstep-gateway.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pstep/engine
ExecStart=/usr/local/bin/node /opt/pstep/engine/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pstep-engine
MemoryLimit=300M

[Install]
WantedBy=multi-user.target
```

**pstep-web.service:**
```ini
[Unit]
Description=Pstep Web UI - Static File Server
After=network-online.target pstep-gateway.service
Wants=network-online.target
Requires=pstep-gateway.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/pstep/web
ExecStart=/usr/local/bin/node /usr/local/lib/node_modules/serve/build/main.js /opt/pstep/web/dist -p 5173 --cors
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=pstep-web
MemoryLimit=100M

[Install]
WantedBy=multi-user.target
```

### 回滚

```bash
# 列出备份
ls /opt/pstep/backups/

# 回滚到指定备份
rsync -a /opt/pstep/backups/20250515_215300/gateway/ /opt/pstep/gateway/
rsync -a /opt/pstep/backups/20250515_215300/web/ /opt/pstep/web/
systemctl restart pstep-gateway pstep-web
```

---

## 🧩 各仓库职责与边界

| 仓库 | 能做什么 | 不能做什么 |
|------|----------|------------|
| **pstep-engine** | 定义 Plan/Solve/Verify 消息、工具、钩子，CI/CD 编排 | ❌ 不能依赖 UI 组件 |
| **pstep-gateway** | 路由请求、管理 API Key、用量统计 | ❌ 不能依赖 pi 或 pstep-engine |
| **pstep-web** | 自定义 UI、渲染器 | ❌ 不能包含 Agent 核心逻辑 |

---

## 📁 推荐目录结构

### pstep-engine

```
pstep-engine/
├── src/
│   ├── messages/
│   │   ├── plan.ts           ← PlanMessage (declaration merging)
│   │   ├── solve.ts          ← SolveMessage
│   │   └── verify.ts         ← VerifyMessage
│   ├── tools/
│   │   ├── plan-executor.ts  ← Plan 执行工具
│   │   ├── solve-executor.ts ← Solve 执行工具
│   │   └── verify-executor.ts← Verify 执行工具
│   ├── hooks/
│   │   ├── convert-to-llm.ts ← 自定义消息→LLM 消息转换
│   │   ├── before-tool-call.ts
│   │   └── after-tool-call.ts
│   ├── loop/
│   │   └── plan-solve-loop.ts← Plan/Solve/Verify 循环控制
│   ├── types.ts              ← 类型声明 + declaration merging
│   └── index.ts              ← 统一导出
├── package.json              ← deps: @org/pi-agent-core, @org/pi-ai
├── tsconfig.json
└── README.md
```

### pstep-gateway

```
pstep-gateway/
├── src/
│   ├── server.ts             ← HTTP 服务入口
│   ├── router.ts             ← 路由: model → upstream
│   ├── providers/
│   │   ├── anthropic.ts      ← Anthropic 适配器
│   │   └── openai.ts         ← OpenAI 适配器
│   ├── auth.ts               ← API Key 管理
│   └── types.ts
├── package.json
├── Dockerfile
└── README.md
```

### pstep-web

```
pstep-web/
├── src/
│   ├── main.ts               ← 应用入口
│   ├── components/
│   │   ├── PlanPanel.ts      ← Plan 展示面板
│   │   ├── SolveView.ts      ← Solve 执行视图
│   │   └── VerifyTimeline.ts ← Verify 时间线
│   ├── renderers/
│   │   ├── plan-renderer.ts
│   │   ├── solve-renderer.ts
│   │   └── verify-renderer.ts
│   ├── stores/
│   │   └── plan-store.ts     ← Plan 持久化存储
│   ├── styles/
│   │   └── app.css
│   └── vite-env.d.ts
├── index.html
├── package.json              ← deps: pstep-engine, @org/pi-web-ui
├── vite.config.ts
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml        ← 部署编排
└── .github/workflows/
    └── release.yml           ← 一键发布工作流
```

---

## ✅ 快速开始（首次搭建）

```bash
# 1. 克隆主仓库
git clone https://github.com/panda2877/pstep-engine.git
git clone https://github.com/panda2877/pstep-gateway.git
git clone https://github.com/panda2877/pstep-web.git

# 2. 安装依赖
cd pstep-engine && npm install
cd ../pstep-gateway && npm install
cd ../pstep-web && npm install

# 3. 本地开发串联（可选）
cd pstep-engine && npm link
cd ../pstep-web && npm link pstep-engine

# 4. 启动开发服务器
cd ../pstep-web && npm run dev
```

---

## 📝 许可证

- pi 框架: [MIT License](https://github.com/earendil-works/pi/blob/main/LICENSE)
- pstep-engine / pstep-gateway / pstep-web: [MIT License](LICENSE)