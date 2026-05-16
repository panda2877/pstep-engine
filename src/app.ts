/**
 * pstep-engine 应用入口
 * 创建并启动 HTTP 服务器
 */

import { createServer } from "./server/index.js";

const app = createServer();

// 启动服务器
app.start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// 优雅关闭
export { app };
