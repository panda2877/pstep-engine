# pstep Web UI

pstep 前端 Web UI，基于 React + TypeScript + Tailwind CSS 构建。

## 开发环境

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

开发服务器将在 `http://localhost:3005` 启动，并自动代理 API 请求到后端 `http://localhost:4000`。

### 构建生产版本

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览生产版本

```bash
npm run preview
```

## 项目结构

```
web/
├── public/              # 静态资源
├── src/
│   ├── assets/          # 资源文件
│   ├── components/      # 通用组件
│   │   └── layout/      # 布局组件
│   ├── features/        # 功能模块
│   ├── hooks/           # 自定义 Hooks
│   ├── services/        # API 服务层
│   ├── stores/          # 状态管理
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数
│   ├── App.tsx          # 主组件
│   ├── main.tsx         # 入口文件
│   └── index.css        # 全局样式
├── index.html           # HTML 模板
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
└── vite.config.ts       # Vite 配置
```

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **样式**: Tailwind CSS 4
- **HTTP 客户端**: 浏览器原生 Fetch API
- **SSE**: 浏览器原生 EventSource API

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `VITE_API_BASE` | API 基础路径 | `/` |

## API 代理

开发模式下，Vite 会自动将以下请求代理到后端：

- `/api/*` → `http://localhost:4000/api/*`
- `/health` → `http://localhost:4000/health`

## 部署

### 方式 1：独立部署

```bash
# 构建
npm run build

# 部署 dist/ 目录到 Web 服务器
```

### 方式 2：与后端集成

将构建产物 `dist/` 目录复制到 pstep-engine 服务器，由后端提供静态文件服务。

### 方式 3：Docker 部署

```dockerfile
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3005
CMD ["nginx", "-g", "daemon off;"]
```

## 开发规范

- 组件使用 PascalCase 命名（如 `Topbar.tsx`）
- 工具函数使用 camelCase 命名（如 `formatDate.ts`）
- 类型定义使用 PascalCase 命名（如 `UserProfile`）
- 样式优先使用 Tailwind CSS 类名
- 复杂样式使用 CSS 变量（定义在 `index.css`）

## 相关文档

- [前端开发计划](../docs/web-ui-development-plan.md)
- [API 接口参考](../docs/web-ui-api-reference.md)
