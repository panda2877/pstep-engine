# pstep Web UI 前端开发计划

> 基于原型图 `protype/mqqoijrx-chat-prototype-v3.html` 与现有 pstep-engine 后端接口分析

---

## 一、功能清单

### 1.1 核心功能模块

#### 1. Topbar（顶部导航栏）
- **品牌展示**：Logo + 产品名 "pstep"
- **会话信息**：
  - 当前使用的模型名称
  - 上下文 token 使用情况（已用/总量）
  - 里程碑进度条（MS7、进度百分比）
- **连接状态**：实时显示连接状态和持续时间

#### 2. Fn Bar（功能栏）
- **视图切换**：
  - 聊天视图（默认）
  - 设置视图
- **工具提示**：hover 显示功能说明

#### 3. Agent Bar（左侧 Agent 列表）
- **Agent 管理**：
  - 显示多个 Agent（紫灵、幸如音、文思月、银月）
  - 每个 Agent 包含：头像、名称、状态指示灯、描述
  - 折叠/展开交互
  - 新建 Agent 按钮
- **会话管理**：
  - 每个 Agent 下显示多个历史会话
  - 会话显示：名称、最后更新时间
  - 新建会话按钮
  - 二级目录结构（树形展开）

#### 4. Message Area（消息区域）
- **消息头部**：
  - 当前 Agent 头像和名称
  - 当前会话标签
  - 记忆状态徽章（点击查看详情）
  - 搜索按钮
  - 展开辅助面板按钮
- **消息列表**：
  - 日期分隔符
  - 用户消息（右对齐）
  - Agent 消息（左对齐）
  - 消息气泡（支持富文本、代码块）
  - 消息时间戳
  - 流式输出指示器（跳动的点动画）
- **输入区域**：
  - 工具栏：附件按钮、新建会话按钮
  - 文本输入框（自动调整高度）
  - 发送按钮（金色主题）
  - 快捷键支持（Ctrl+Enter 发送、Esc 关闭搜索）

#### 5. Helper Panel（辅助面板）
- **User 标签页**：
  - 用户资料展示（姓名、职业、特点、偏好）
- **Soul 标签页**：
  - Agent 定义（角色、性格、职责、口头禅）
- **Memory 标签页**：
  - 记忆条目列表（支持多条记忆）
  - 每条记忆包含：ID、内容、来源信息
- **面板交互**：
  - 折叠/展开动画
  - 移动端抽屉式弹出
  - 遮罩层关闭

#### 6. Search Modal（搜索模态框）
- **搜索输入**：实时搜索当前会话内容
- **搜索结果**：
  - 高亮匹配关键词
  - 显示消息时间
  - 空状态提示

#### 7. 移动端适配
- **响应式布局**（PC >= 768px / 移动端 < 768px 两档）：
  - 隐藏 Fn Bar 和 Agent Bar
  - 消息头部：`<` 返回按钮进入 Agent 列表
  - 消息头部：辅助面板按钮展开右侧抽屉
  - 辅助面板：从右侧滑入，带遮罩层

---

## 二、对接清单

### 2.1 现有 API 接口分析

| 功能需求 | 现有接口 | 接口状态 | 改造需求 |
|---------|---------|---------|---------|
| **Agent 管理** | ❌ 无 | 需新增 | 需新增 Agent CRUD API |
| **会话管理** | ✅ `/api/sessions` | 可用 | 需扩展（关联 Agent） |
| **消息管理** | ✅ `MessageDao` | 可用 | 需暴露 HTTP API |
| **聊天功能** | ✅ `/api/chat` | 可用 | 需改造（支持 Agent 选择） |
| **项目管理** | ✅ `/api/projects` | 可用 | 直接可用 |
| **规则管理** | ✅ `/api/projects/:id/rules` | 可用 | 直接可用 |
| **记忆系统** | ✅ `MemoryDao` | 可用 | 需暴露 HTTP API |
| **用户资料** | ❌ 无 | 需新增 | 需新增用户管理 API |
| **Agent Soul** | ❌ 无 | 需新增 | 需新增 Agent 配置 API |

### 2.2 数据库现状

**现有表结构**：
- `projects` - 项目表 ✅
- `project_rules` - 项目规则表 ✅
- `sessions` - 会话表 ✅（但无 agent_id 字段）
- `session_messages` - 消息表 ✅
- `memory_entries` - 记忆表 ✅

**缺少的表**：
- `agents` - Agent 表（需新增）
- `users` - 用户表（需新增）

---

## 三、接口改造分析

### 3.1 可直接使用的接口 ✅

```typescript
// 1. 项目管理
GET    /api/projects          // 获取项目列表
POST   /api/projects          // 创建项目
GET    /api/projects/:id      // 获取项目详情

// 2. 规则管理
GET    /api/projects/:id/rules    // 获取项目规则
PUT    /api/projects/:id/rules    // 更新规则
DELETE /api/projects/:id/rules    // 删除规则

// 3. 健康检查
GET    /health                // 服务健康检查
```

### 3.2 需要改造的接口 🔧

#### 1. 会话管理接口改造

**现状**：Session 与 Project 关联，无 Agent 概念
**目标**：Session 需要同时关联 Project 和 Agent

```typescript
// 需要改造的接口
GET    /api/sessions?projectId=xxx        // 改为支持 agentId 查询
POST   /api/sessions                       // 需要增加 agentId 参数
GET    /api/sessions/:id                   // 返回值需包含 agent 信息

// 数据库改造
ALTER TABLE sessions ADD COLUMN agent_id TEXT REFERENCES agents(id);
```

#### 2. 聊天接口改造

**现状**：`/api/chat` 只接收 projectId 和 message
**目标**：需要支持选择 Agent，不同 Agent 有不同的 Soul 配置

```typescript
// 现有接口
POST /api/chat { projectId, sessionId, message, stream }

// 改造后
POST /api/chat { projectId, agentId, sessionId, message, stream }

// 改造逻辑
- 根据 agentId 加载对应的 Soul 配置
- 将 Soul 配置注入到 system prompt
- 返回消息时携带 agent 信息
```

### 3.3 需要新增的接口 🆕

#### 1. Agent 管理 API

```typescript
// Agent CRUD
GET    /api/agents                      // 获取 Agent 列表
POST   /api/agents                      // 创建 Agent
GET    /api/agents/:id                  // 获取 Agent 详情
PUT    /api/agents/:id                  // 更新 Agent
DELETE /api/agents/:id                  // 删除 Agent

// Agent 会话关联
GET    /api/agents/:id/sessions         // 获取 Agent 下的会话列表
```

**Agent 数据模型**：
```typescript
interface Agent {
  id: string;
  name: string;                    // Agent 名称（如"紫灵"）
  avatar?: string;                 // 头像 URL
  initial?: string;                // 头像首字母
  description?: string;            // 描述（如"需求/创意专家"）
  soul: {
    role: string;                  // 角色定义
    personality: string;           // 性格特点
    responsibilities: string;      // 职责描述
    catchphrase?: string;          // 口头禅
  };
  status: 'active' | 'inactive';  // 状态
  createdAt: number;
  updatedAt: number;
}
```

**数据库建表语句**：
```sql
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  initial TEXT,
  description TEXT,
  soul_json TEXT NOT NULL,          -- JSON 格式的 Soul 配置
  status TEXT DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### 2. 用户管理 API

```typescript
// 用户资料
GET    /api/users/me               // 获取当前用户资料
PUT    /api/users/me               // 更新用户资料
```

**用户数据模型**：
```typescript
interface UserProfile {
  id: string;
  name: string;                    // 姓名
  occupation?: string;             // 职业
  preferences?: {
    callCountBilling?: boolean;    // 按调用次数付费
    nickname?: string;             // 昵称偏好
  };
  createdAt: number;
  updatedAt: number;
}
```

**数据库建表语句**：
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  occupation TEXT,
  preferences_json TEXT,           -- JSON 格式的偏好设置
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### 3. 记忆管理 API

```typescript
// 记忆条目
GET    /api/memory?projectId=xxx           // 获取项目记忆
GET    /api/memory?projectId=xxx&category=xxx  // 按分类获取
POST   /api/memory                         // 创建记忆
DELETE /api/memory/:id                     // 删除记忆
```

#### 4. 消息搜索 API

```typescript
// 消息搜索
GET /api/messages/search?sessionId=xxx&query=xxx  // 搜索会话消息
```

---

## 四、前端技术方案

### 4.1 技术栈选择

```typescript
推荐技术栈：
├── 框架：React 18 + TypeScript
├── 状态管理：Zustand（轻量级）
├── 路由：React Router v6
├── 样式：Tailwind CSS + CSS Modules
├── HTTP 客户端：Ky 或 Axios
├── SSE 处理：EventSource API
├── 构建工具：Vite
└── 包管理：pnpm
```

### 4.2 项目结构

```
pstep-web/
├── public/
├── src/
│   ├── assets/               # 静态资源
│   ├── components/           # 通用组件
│   │   ├── ui/              # 基础 UI 组件
│   │   ├── layout/          # 布局组件
│   │   └── common/          # 业务通用组件
│   ├── features/            # 功能模块
│   │   ├── agents/          # Agent 管理
│   │   ├── chat/            # 聊天功能
│   │   ├── memory/          # 记忆系统
│   │   ├── settings/        # 设置页面
│   │   └── search/          # 搜索功能
│   ├── hooks/               # 自定义 Hooks
│   ├── services/            # API 服务层
│   │   ├── api.ts           # API 客户端
│   │   ├── agents.ts        # Agent API
│   │   ├── sessions.ts      # Session API
│   │   ├── messages.ts      # Message API
│   │   └── sse.ts           # SSE 连接管理
│   ├── stores/              # 状态管理
│   │   ├── agentStore.ts    # Agent 状态
│   │   ├── sessionStore.ts  # 会话状态
│   │   ├── messageStore.ts  # 消息状态
│   │   └── uiStore.ts       # UI 状态
│   ├── types/               # TypeScript 类型
│   ├── utils/               # 工具函数
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── index.html
```

### 4.3 核心组件设计

#### 1. 布局组件

```typescript
// src/components/layout/AppLayout.tsx
export const AppLayout = () => (
  <div className="app">
    <Topbar />
    <div className="main-layout">
      <FnBar />
      <AgentBar />
      <MessageArea />
      <HelperPanel />
    </div>
    <SearchModal />
  </div>
);
```

#### 2. Agent 列表组件

```typescript
// src/features/agents/AgentList.tsx
export const AgentList = () => {
  const { agents, selectedAgent, selectAgent } = useAgentStore();

  return (
    <div className="agent-list">
      {agents.map(agent => (
        <AgentRow
          key={agent.id}
          agent={agent}
          isActive={selectedAgent?.id === agent.id}
          onSelect={() => selectAgent(agent)}
        />
      ))}
    </div>
  );
};
```

#### 3. 消息流式输出

```typescript
// src/features/chat/useChatStream.ts
export const useChatStream = () => {
  const streamMessage = async (params: ChatParams) => {
    const eventSource = new EventSource(
      `/api/chat?${new URLSearchParams(params)}`
    );

    eventSource.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      // 处理不同类型的消息
      switch (data.type) {
        case 'plan':
          // 显示计划阶段
          break;
        case 'step':
          // 显示步骤执行
          break;
        case 'content':
          // 流式追加内容
          break;
        case 'done':
          // 完成
          break;
      }
    });

    return () => eventSource.close();
  };

  return { streamMessage };
};
```

---

## 五、开发计划

### Phase 1：基础框架搭建 ✅

**目标**：完成项目初始化和核心布局

- [x] 初始化 Vite + React + TypeScript 项目
- [x] 配置 Tailwind CSS 和设计系统（颜色、字体、间距）
- [x] 实现 AppLayout 整体布局
- [x] 实现 Topbar 组件
- [x] 实现 FnBar 组件
- [x] 实现 AgentBar 组件（含会话列表）
- [x] 实现 MessageArea 组件（含消息头部、消息列表、输入区域）
- [x] 实现 HelperPanel 组件（User/Soul/Memory 标签页）
- [x] 实现 SearchModal 搜索模态框
- [x] 实现响应式布局（PC + 移动端两档）
- [x] 实现移动端辅助面板滑入动画
- [x] 实现移动端顶部导航（返回按钮 + 辅助面板按钮）
- [x] CI/CD 流水线（GitHub Actions 自动构建部署）

**交付物**：静态 UI 与原型图一致，布局、样式、交互完整还原

### Phase 2：Agent 管理模块 ✅

**目标**：完成 Agent 列表和会话管理

- [x] 后端：新增 `agents` 表和 CRUD API
- [x] 后端：改造 `sessions` 表，增加 `agent_id` 字段
- [x] 前端：对接 Agent 列表 API，替换 Mock 数据
- [x] 前端：实现新建 Agent 功能
- [x] 前端：实现 Agent 折叠/展开交互
- [x] 前端：对接会话列表 API，实现会话切换
- [x] 前端：实现新建会话功能
- [x] 前端：实现会话右键菜单（重命名/删除）

**交付物**：Agent 列表可正常显示和切换，会话支持重命名和删除

### Phase 3：聊天核心功能

**目标**：完成消息收发和流式输出

- [ ] 后端：改造 `/api/chat` 接口，支持 agentId
- [ ] 后端：实现消息搜索 API
- [ ] 前端：对接消息列表 API，替换 Mock 数据
- [ ] 前端：实现 SSE 流式消息接收
- [ ] 前端：实现输入框和发送功能
- [ ] 前端：实现流式输出动画效果
- [ ] 前端：实现消息持久化

**交付物**：可正常对话，支持流式输出

### Phase 4：辅助面板和搜索

**目标**：完成 Helper Panel 和搜索功能

- [ ] 后端：新增用户管理 API
- [ ] 后端：暴露记忆管理 API
- [ ] 前端：对接用户资料 API
- [ ] 前端：对接 Agent Soul 配置 API
- [ ] 前端：对接记忆管理 API
- [ ] 前端：实现消息搜索功能（对接搜索 API）

**交付物**：辅助面板和搜索功能完整

### Phase 5：移动端适配和优化

**目标**：完成移动端适配和性能优化

- [ ] 前端：优化消息列表性能（虚拟滚动）
- [ ] 前端：添加键盘快捷键支持
- [ ] 前端：添加错误处理和加载状态
- [ ] 前端：添加 SSE 断线重连机制

**交付物**：移动端可用，体验流畅

### Phase 6：联调测试和部署

**目标**：完成前后端联调和部署

- [ ] 前后端联调测试
- [ ] 修复 Bug 和边界情况
- [ ] 性能优化和代码审查
- [ ] 编写部署文档
- [ ] 部署到测试环境

**交付物**：可部署的完整应用

---

## 六、时间估算

| 阶段 | 时间 | 关键产出 | 状态 |
|-----|------|---------|------|
| Phase 1 | 1 周 | 基础布局框架 | ✅ 完成 |
| Phase 2 | 1 周 | Agent 管理功能 | ✅ 完成 |
| Phase 3 | 1.5 周 | 聊天核心功能 | 待开发 |
| Phase 4 | 1 周 | 辅助面板和搜索 | 待开发 |
| Phase 5 | 0.5 周 | 移动端适配 | 待开发 |
| Phase 6 | 1 周 | 联调部署 | 待开发 |
| **总计** | **6 周** | 完整 Web UI | |

---

## 七、风险和注意事项

### 7.1 技术风险

1. **SSE 连接稳定性**
   - 风险：长时间无响应导致连接断开
   - 方案：实现心跳机制和自动重连

2. **大量消息性能**
   - 风险：会话消息过多导致渲染卡顿
   - 方案：实现虚拟滚动，分页加载历史消息

3. **流式输出闪烁**
   - 风险：频繁更新 DOM 导致界面闪烁
   - 方案：使用 requestAnimationFrame 节流更新

### 7.2 后端改造风险

1. **数据库迁移**
   - 风险：ALTER TABLE 可能影响现有数据
   - 方案：编写安全的迁移脚本，备份数据

2. **Agent Soul 注入**
   - 风险：不同 Agent 的 prompt 差异大
   - 方案：设计灵活的 prompt 模板系统

### 7.3 设计还原风险

1. **深色主题细节**
   - 风险：颜色值、阴影、动画细节差异
   - 方案：提取 CSS 变量，精确还原设计稿

2. **响应式断点**
   - 风险：移动端布局可能有边界情况
   - 方案：充分测试不同屏幕尺寸

---

## 八、验收标准

### 8.1 功能验收

- [ ] Agent 列表正常显示，可折叠/展开
- [ ] 会话切换正常，消息正确加载
- [ ] 消息发送和接收正常
- [ ] 流式输出动画流畅
- [ ] 辅助面板三个标签页内容正确
- [ ] 搜索功能正常工作
- [ ] 移动端布局正常

### 8.2 性能验收

- [ ] 首屏加载时间 < 2s
- [ ] 消息发送响应时间 < 100ms
- [ ] 流式输出延迟 < 200ms
- [ ] 滚动流畅，无卡顿

### 8.3 兼容性验收

- [ ] Chrome/Edge/Firefox 最新版本
- [ ] Safari 16+
- [ ] iOS Safari / Android Chrome
- [ ] 响应式断点：768px, 1024px, 1440px

---

## 九、后续扩展

### 9.1 功能扩展

- [ ] 文件上传功能
- [ ] 消息撤回和编辑
- [ ] 会话导出（Markdown/PDF）
- [ ] 多语言支持
- [ ] 主题切换（深色/浅色）

### 9.2 性能扩展

- [ ] 消息分页加载
- [ ] 图片懒加载
- [ ] Service Worker 离线缓存
- [ ] WebSocket 替代 SSE

### 9.3 集成扩展

- [ ] 飞书 OAuth 登录
- [ ] 企业微信集成
- [ ] 钉钉集成

---

**文档版本**：v1.0
**创建日期**：2026-06-24
**作者**：Claude Code
