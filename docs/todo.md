# pstep Web UI 开发待办

> 从开发计划中提取的未完成项，按优先级排列

---

## Phase 1：基础框架 ✅

### 后端

- [x] 新增 `projects` 表和 CRUD API
- [x] 新增 `sessions` 表和 CRUD API
- [x] 新增 `messages` 表和搜索 API
- [x] 实现 `/api/chat` SSE 流式接口
- [x] 静态文件托管（@fastify/static）
- [x] 消息持久化（orchestrator.saveMessages）

### 前端

- [x] 项目侧边栏（项目/会话/Agent 列表）
- [x] 消息区域（消息列表、输入框、流式输出）
- [x] 辅助面板（Agent/会话/规则管理）
- [x] SSE 流式消息接收（fetch + ReadableStream）
- [x] Markdown 渲染（react-markdown + remark-gfm）
- [x] Mermaid 图表渲染（流程图/序列图等，带防抖）
- [x] 搜索弹窗（对接消息搜索 API）
- [x] 全局状态管理（React Context + useReducer）

---

## Phase 2：Agent 管理模块

### 后端

- [x] 新增 `agents` 表和 CRUD API
- [x] 改造 `sessions` 表，增加 `agent_id` 字段

### 前端

- [x] 对接 Agent 列表 API，替换 Mock 数据
- [x] 实现新建 Agent 功能
- [x] 实现 Agent 折叠/展开交互
- [x] 对接会话列表 API，实现会话切换
- [x] 实现新建会话功能

---

## Phase 3：聊天核心功能

### 后端

- [x] 改造 `/api/chat` 接口，支持 agentId
- [x] 实现消息搜索 API
- [x] 多轮对话上下文（loadHistory 加载 user 消息）

### 前端

- [x] 对接消息列表 API，替换 Mock 数据
- [x] 实现 SSE 流式消息接收
- [x] 实现输入框和发送功能
- [x] 实现流式输出动画效果
- [x] 实现消息持久化

---

## Phase 4：辅助面板和搜索

### 后端

- [x] 暴露记忆管理 API

### 前端

- [ ] 对接 Agent Soul 配置 API（当前为 Mock 数据）
- [ ] 对接记忆管理 API（当前为 Mock 数据）
- [ ] 对接用户资料 API（当前为 Mock 数据）
- [x] 实现消息搜索功能（对接搜索 API）

---

## Phase 5：移动端适配和优化

- [ ] 优化消息列表性能（虚拟滚动）
- [ ] 添加键盘快捷键支持
- [x] 添加错误处理和加载状态
- [ ] 添加 SSE 断线重连机制

---

## Phase 6：联调测试和部署

- [x] 前后端联调测试
- [x] 修复 Bug 和边界情况
- [x] 部署到测试环境（CI/CD 自动部署）
- [ ] 性能优化和代码审查

---

## 已修复的 Bug

- [x] 连续对话第二条消息无响应（assistant 消息缺少 pi-ai 必需字段）
- [x] Mermaid 图表流式更新闪烁（400ms 防抖）
- [x] Mermaid 渲染错误（唯一 ID + DOM 清理 + useEffect 修复）
- [x] 消息重复保存（从 streaming 循环中移除 MessageDao.create）
- [x] 流式内容不显示（前端 type 检查修复）

---

## 后续扩展

### 功能扩展

- [ ] 文件上传功能
- [ ] 消息撤回和编辑
- [ ] 会话导出（Markdown/PDF）
- [ ] 多语言支持
- [ ] 主题切换（深色/浅色）

### 性能扩展

- [ ] 消息分页加载
- [ ] 图片懒加载
- [ ] Service Worker 离线缓存
- [ ] WebSocket 替代 SSE

### 集成扩展

- [ ] 飞书 OAuth 登录
- [ ] 企业微信集成
- [ ] 钉钉集成

---

**文档版本**：v1.1
**创建日期**：2026-06-25
**更新日期**：2026-06-26
