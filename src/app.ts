/**
 * pstep-engine 应用入口
 * 创建并启动 HTTP 服务器 + (可选) 飞书 / Lark 渠道
 */

import { createServer } from "./server/index.js";
import { FeishuClient, MessageRouter, SessionMapper, type EngineAdapter } from "./channels/feishu/index.js";
import { MessageDao } from "./db/dao.js";
import type { PstepMessage } from "./types/messages.js";

const app = createServer({
  loadHistory: async (sessionId: string) => {
    const messages = MessageDao.findBySession(sessionId);
    // 只加载 user 消息作为历史上下文。
    // assistant 消息需要 pi-ai 的完整 AssistantMessage 结构（api/provider/model/usage/stopReason），
    // 我们数据库中没有这些字段，传入会导致 pi-agent-core 第二次 prompt() 时 LLM 返回空内容。
    return messages
      .filter((m) => m.role === "user")
      .map((m) => ({ role: "user" as const, content: m.content }));
  },
  saveMessages: async (sessionId: string, entries) => {
    for (const entry of entries) {
      MessageDao.create({ sessionId, role: entry.role, content: entry.content });
    }
  },
});

// ----------------------------------------------------------------------------
// 飞书渠道 (env 守门：缺一即跳过)
// ----------------------------------------------------------------------------
let feishuChannel: { stop: () => Promise<void> } | null = null;
if (process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET) {
  const cfg = {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
    mentionRequiredInGroup: process.env.FEISHU_GROUP_MENTION_REQUIRED !== "false",
    cardFlushMs: process.env.FEISHU_CARD_FLUSH_MS ? Number(process.env.FEISHU_CARD_FLUSH_MS) : 200,
    cardMaxBytes: process.env.FEISHU_CARD_MAX_BYTES ? Number(process.env.FEISHU_CARD_MAX_BYTES) : 25_000,
    debug: process.env.FEISHU_DEBUG === "true",
  };

  // Adapter: bridge PstepEngine.execute() to EngineAdapter (the channel
  // shouldn't know about the engine class — it just consumes an AsyncIterable
  // of PstepMessage).
  const adapter: EngineAdapter = {
    execute(text: string, projectId: string, sessionId: string): AsyncIterable<PstepMessage> {
      return app.engine.execute(text, projectId, sessionId);
    },
  };

  const client = new FeishuClient(cfg);
  const sessionMapper = new SessionMapper(process.env.FEISHU_CHAT_PROJECT_MAP);
  const router = new MessageRouter({ client, engine: adapter, sessionMapper, config: cfg });

  client
    .start(async (event, envelope) => {
      try {
        await router.handle(envelope);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[feishu] router.handle threw:", err);
      }
    })
    .then(() => {
      // eslint-disable-next-line no-console
      console.log(`[Feishu] channel up (group mention required: ${cfg.mentionRequiredInGroup}, flush ${cfg.cardFlushMs}ms)`);
      feishuChannel = {
        stop: async () => {
          // WSClient has no formal stop in 1.67; tearing down the process
          // is the only way. We expose a hook for symmetry / future use.
        },
      };
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[Feishu] channel failed to start:", err);
    });
} else {
  // eslint-disable-next-line no-console
  console.log("[Feishu] channel skipped (FEISHU_APP_ID / FEISHU_APP_SECRET not set)");
}

// ----------------------------------------------------------------------------
// 启动 HTTP 服务
// ----------------------------------------------------------------------------
app.start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

// ----------------------------------------------------------------------------
// 优雅关闭
// ----------------------------------------------------------------------------
async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[App] received ${signal}, shutting down`);
  if (feishuChannel) await feishuChannel.stop();
  await app.stop();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

export { app };

