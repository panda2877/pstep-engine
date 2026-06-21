# pi-cli：基于 pi-ai 和 pi-agent-core 的轻量级 Agent CLI

基于 `pi-ai`（统一 LLM API 调用层）和 `pi-agent-core`（Agent 运行时核心）构建的轻量级 Agent CLI。

支持交互式问答、工具调用、自定义网关，可直接部署到 OpenDesign 等工具平台。

---

## 架构概览

```
┌─────────────────────────────────────────────────────────┐
│                    pi-agent CLI                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  交互模式    │  │  单次模式    │  │  工具 (文件)    │ │
│  │ (readline)   │  │ (argv)      │  │  write/read     │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
│         │                │                   │          │
│         └────────────────┴───────────────────┘          │
│                          │                              │
│                  ┌───────▼───────┐                      │
│                  │  Agent 实例    │                      │
│                  │ (pi-agent-core)│                      │
│                  └───────┬───────┘                      │
│                          │                              │
│                  ┌───────▼───────┐                      │
│                  │  pi-ai 调用层  │                      │
│                  │  getModel()    │                      │
│                  └───────┬───────┘                      │
│                          │                              │
└──────────────────────────┼──────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │  LLM API (支持自定义网关) │
              │  OpenAI / Anthropic /   │
              │  MiniMax / 其他         │
              └─────────────────────────┘
```

---

## 快速开始

### 1. 安装

```bash
npm install @panda2877/pstep-engine
```

### 2. 配置环境变量

```bash
# 标准 OpenAI
export LLM_API_KEY="sk-..."

# 或使用自定义网关
export LLM_PROVIDER="minimax"
export LLM_MODEL="MiniMax-M2.7"
export LLM_MODEL_ID="MiniMax-M3"
export LLM_BASE_URL="http://your-gateway:port"
export LLM_API_KEY="your-key"
```

### 3. 运行

```bash
# 交互模式
npx @panda2877/pstep-engine

# 单次执行
npx @panda2877/pstep-engine "帮我写一个 hello world"
```

---

## 环境变量配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_PROVIDER` | 模型 Provider | `openai` |
| `LLM_MODEL` | 模型名称（pi-ai 内置列表） | `gpt-4o` |
| `LLM_MODEL_ID` | 实际发送给 API 的模型 ID（覆盖内置） | - |
| `LLM_BASE_URL` | 自定义 API 地址（覆盖内置 baseUrl） | - |
| `LLM_API_KEY` | API Key | - |

---

## 代码架构详解

### 核心模块

#### 1. Agent 创建

```typescript
function createAgent(): Agent {
  // 1. 从 pi-ai 获取模型配置
  const model = getModel(MODEL_PROVIDER, MODEL_NAME);

  // 2. 支持自定义覆盖（网关场景）
  const finalModel = {
    ...model,
    ...(BASE_URL && { baseUrl: BASE_URL }),
    ...(MODEL_ID && { id: MODEL_ID }),
    ...(API_KEY && { headers: { 'Authorization': `Bearer ${API_KEY}` } }),
  };

  // 3. 创建 Agent 实例
  return new Agent({
    initialState: {
      model: finalModel,
      systemPrompt: `...`,
      tools: [ /* 工具列表 */ ],
    },
    getApiKey: API_KEY ? async () => API_KEY : undefined,
  });
}
```

**关键点：**
- `getModel()` 从 pi-ai 获取标准模型配置
- 自定义覆盖支持网关场景（baseUrl、modelId、认证头）
- Agent 使用 `initialState` 传入初始配置

#### 2. 工具定义

```typescript
{
  name: "write_file",           // 工具名称（唯一标识）
  description: "Write content to a file",  // 描述（供 LLM 理解）
  label: "Write File",          // 显示标签（UI 用）
  parameters: {                 // JSON Schema 参数定义
    type: "object",
    properties: {
      path: { type: "string", description: "File path" },
      content: { type: "string", description: "File content" },
    },
    required: ["path", "content"],
  },
  execute: async (toolCallId, params) => {
    // toolCallId: 调用 ID（用于追踪）
    // params: 经过 Schema 验证的参数
    const fs = await import("fs/promises");
    await fs.writeFile(params.path, params.content, "utf-8");
    return {
      content: [{ type: "text", text: `Successfully wrote to ${params.path}` }],
      details: undefined,  // 可选的详细信息
    };
  },
}
```

**工具返回格式：**
```typescript
{
  content: (TextContent | ImageContent)[];  // 返回给 LLM 的内容
  details: any;                              // 可选的结构化详情
  terminate?: boolean;                       // 是否终止 Agent
}
```

#### 3. 事件订阅

```typescript
// 订阅所有事件
agent.subscribe(async (event) => {
  switch (event.type) {
    case "message_update":
      // 流式文本输出
      if (event.assistantMessageEvent?.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "message_end":
      // 消息完成
      console.log("Done");
      break;
  }
});
```

**事件类型：**
| 事件 | 说明 |
|------|------|
| `agent_start` | Agent 开始运行 |
| `agent_end` | Agent 结束运行 |
| `turn_start` | 轮次开始 |
| `turn_end` | 轮次结束 |
| `message_start` | 消息开始 |
| `message_update` | 消息更新（含流式 delta） |
| `message_end` | 消息结束 |
| `tool_execution_start` | 工具执行开始 |
| `tool_execution_end` | 工具执行结束 |

#### 4. 运行模式

**单次模式：**
```typescript
async function runSingleShot(input: string): Promise<void> {
  const agent = createAgent();

  agent.subscribe(async (event) => {
    if (event.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  await agent.prompt(input);
  console.log();
}
```

**交互模式：**
```typescript
async function runInteractive(): Promise<void> {
  const agent = createAgent();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  agent.subscribe(async (event) => {
    if (event.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  while (true) {
    const userInput = await promptUser();
    if (userInput.toLowerCase() === "exit") break;

    await agent.prompt(userInput);
    console.log();
  }
}
```

---

## 自定义网关配置

当使用私有网关（如 MiniMax）时，需要覆盖 pi-ai 的默认配置：

```bash
export LLM_PROVIDER="minimax"        # 使用 minimax provider 的 API 格式
export LLM_MODEL="MiniMax-M2.7"      # pi-ai 内置的模型配置
export LLM_MODEL_ID="MiniMax-M3"     # 实际发送给 API 的模型 ID
export LLM_BASE_URL="http://gateway:3002"  # 网关地址
export LLM_API_KEY="your-key"        # 网关 API Key
```

**原理：**
1. `getModel("minimax", "MiniMax-M2.7")` 获取 minimax 的 API 格式（anthropic-messages）
2. 覆盖 `baseUrl` 指向你的网关
3. 覆盖 `id` 为网关实际支持的模型名
4. 通过 `headers` 注入认证信息

---

## 部署到 OpenDesign

### 步骤 1：初始化项目

```bash
mkdir my-design-agent
cd my-design-agent
npm init -y
```

### 步骤 2：安装依赖

```bash
npm install @earendil-works/pi-ai @earendil-works/pi-agent-core
npm install -D typescript @types/node tsx
```

### 步骤 3：编写 Agent 代码

```typescript
#!/usr/bin/env node

import { Agent } from "@earendil-works/pi-agent-core";
import { getModel } from "@earendil-works/pi-ai";

async function main() {
  const MODEL_PROVIDER = process.env.LLM_PROVIDER || "openai";
  const MODEL_NAME = process.env.LLM_MODEL || "gpt-4o";
  const MODEL_ID = process.env.LLM_MODEL_ID;
  const BASE_URL = process.env.LLM_BASE_URL;
  const API_KEY = process.env.LLM_API_KEY;

  const model = getModel(MODEL_PROVIDER, MODEL_NAME);

  const finalModel = {
    ...model,
    ...(BASE_URL && { baseUrl: BASE_URL }),
    ...(MODEL_ID && { id: MODEL_ID }),
    ...(API_KEY && { headers: { 'Authorization': `Bearer ${API_KEY}` } }),
  };

  const agent = new Agent({
    initialState: {
      model: finalModel,
      systemPrompt: `You are a design agent that generates high-fidelity web prototypes.
Follow the design system provided by OpenDesign.
Generate React components and HTML/CSS code.`,
      tools: [
        {
          name: "write_file",
          description: "Write content to a file",
          label: "Write File",
          parameters: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path" },
              content: { type: "string", description: "File content" },
            },
            required: ["path", "content"],
          },
          execute: async (toolCallId: string, params: unknown) => {
            const args = params as { path: string; content: string };
            const fs = await import("fs/promises");
            await fs.writeFile(args.path, args.content, "utf-8");
            return {
              content: [{ type: "text" as const, text: `Successfully wrote to ${args.path}` }],
              details: undefined,
            };
          },
        },
      ],
    },
    getApiKey: API_KEY ? async () => API_KEY : undefined,
  });

  const userInput = process.argv.slice(2).join(" ");
  if (!userInput) {
    console.error("Please provide a design prompt.");
    process.exit(1);
  }

  agent.subscribe(async (event) => {
    if (event.type === "message_update" &&
        (event as any).assistantMessageEvent?.type === "text_delta") {
      process.stdout.write((event as any).assistantMessageEvent.delta);
    }
  });

  await agent.prompt(userInput);
  console.log();
}

main().catch(console.error);
```

### 步骤 4：配置 package.json

```json
{
  "name": "my-design-agent",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "my-agent": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "tsx index.ts"
  },
  "dependencies": {
    "@earendil-works/pi-ai": "^0.78.0",
    "@earendil-works/pi-agent-core": "^0.78.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

### 步骤 5：编译并全局安装

```bash
npm run build
npm link
```

### 步骤 6：验证

```bash
# 直接运行
my-agent "设计一个登录页面"

# 或在 OpenDesign 中选择 my-agent
```

---

## API 参考

### Agent

```typescript
const agent = new Agent({
  initialState: {
    model,           // Model 实例 from getModel()
    systemPrompt,    // 系统提示
    tools,           // 工具数组
  },
  getApiKey,         // 可选的 API Key 获取函数
});
```

### 方法

| 方法 | 说明 |
|------|------|
| `agent.prompt(input)` | 发送用户输入 |
| `agent.prompt(messages)` | 发送消息数组 |
| `agent.subscribe(listener)` | 订阅事件 |
| `agent.abort()` | 中止当前运行 |
| `agent.waitForIdle()` | 等待当前任务完成 |
| `agent.reset()` | 重置状态 |

### getModel

```typescript
import { getModel } from "@earendil-works/pi-ai";

const model = getModel(provider, modelId);
// provider: "openai" | "anthropic" | "minimax" | ...
// modelId: "gpt-4o" | "MiniMax-M2.7" | ...
```

---

## 常见问题

### Q: 如何使用自定义网关？

A: 设置 `LLM_BASE_URL` 指向网关地址，并设置 `LLM_API_KEY` 提供认证。

### Q: 工具调用失败怎么办？

A: 工具的 `execute` 函数应抛出异常而不是返回错误内容，Agent 会自动处理错误。

### Q: 如何添加新的工具？

A: 在 `tools` 数组中添加新对象，定义 `name`、`description`、`parameters`（JSON Schema）和 `execute` 函数。

### Q: 如何支持流式输出？

A: 使用 `agent.subscribe()` 监听 `message_update` 事件，当 `assistantMessageEvent.type === "text_delta"` 时获取增量文本。

---

## License

MIT