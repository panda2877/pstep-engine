# plan-solve-core

> Plan & Solve 自定义 Agent 逻辑层
>
> 基于 pi-agent-core + pi-ai 构建的自定义消息类型、工具、Agent 钩子

## 职责

- **消息类型**: PlanMessage, SolveMessage, VerifyMessage (declaration merging)
- **工具**: PlanExecutor, SolveExecutor, VerifyExecutor
- **Agent 钩子**: beforeToolCall, afterToolCall, convertToLlm
- **循环控制**: Plan/Solve/Verify 多步推理循环

## 依赖

- `@panda2877/pi-agent-core` — Agent 运行时
- `@panda2877/pi-ai` — LLM 抽象层

## 开发

```bash
npm install
npm run build
npm test
```

## 发布

```bash
npm version patch  # 或 minor / major
git push && git push --tags
npm publish
```