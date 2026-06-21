/**
 * channels/feishu — public entry
 *
 * Aggregates the channel's public surface. The host wires this into app.ts
 * (Step 7) behind an env-var gate.
 */

export { FeishuClient, type PatchResult } from "./client.js";
export { CardStreamer, type CardStreamerOptions } from "./card-streamer.js";
export { filterMentions, type MentionFilterOptions, type MentionFilterResult } from "./mention-filter.js";
export { MessageRouter, type MessageRouterDeps } from "./message-router.js";
export { SessionMapper, type SessionMapping } from "./session-mapper.js";
export {
  thinkingCard,
  streamingCard,
  finalCard,
  errorCard,
  type StreamingCardMeta,
} from "./card-templates.js";
export type {
  FeishuChannelConfig,
  FeishuMessageEvent,
  FeishuEventEnvelope,
  FeishuMention,
  FeishuMessage,
  FeishuSender,
  CleanedInbound,
  EngineAdapter,
} from "./types.js";
