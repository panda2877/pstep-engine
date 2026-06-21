/**
 * Feishu / Lark channel — internal types
 *
 * These mirror (a subset of) the Feishu v2 event payload shape and the
 * pstep engine message stream, but trimmed to what this channel actually
 * consumes. The SDK's @larksuiteoapi/node-sdk ships its own typings; we
 * keep ours structural (`any` only where the SDK has gaps) so the channel
 * compiles even when the SDK's typings are stricter than we need.
 */

import type { PstepMessage } from "../../types/messages.js";

// ============================================================================
// Inbound event payload (Feishu im.message.receive_v1, schema 2.0)
// ============================================================================

/** Single mention in `event.message.mentions[]` */
export interface FeishuMention {
  /** Placeholder token embedded in `content.text`, e.g. "@_user_1" */
  key: string;
  /** Real IDs of the mentioned entity. */
  id: {
    union_id?: string;
    user_id?: string;
    open_id?: string;
  };
  name?: string;
  tenant_key?: string;
}

/** `event.message` */
export interface FeishuMessage {
  message_id: string;
  root_id?: string;
  parent_id?: string;
  create_time?: string;
  chat_id: string;
  /** "p2p" (DM) or "group" */
  chat_type: "p2p" | "group";
  message_type: "text" | "interactive" | "post" | string;
  /** JSON-stringified blob; for `text` type, parse and read `.text` */
  content: string;
  mentions?: FeishuMention[];
}

/** `event.sender` */
export interface FeishuSender {
  sender_id: {
    union_id?: string;
    user_id?: string;
    open_id?: string;
  };
  sender_type: string;
  tenant_key?: string;
}

/** Top-level event body, after EventDispatcher unwraps schema 2.0 */
export interface FeishuMessageEvent {
  message: FeishuMessage;
  sender: FeishuSender;
}

/** Wrapper that EventDispatcher delivers to our handler (kept loose) */
export interface FeishuEventEnvelope {
  schema?: string;
  header?: {
    event_id?: string;
    event_type?: string;
    create_time?: string;
    token?: string;
    app_id?: string;
    tenant_key?: string;
  };
  event: FeishuMessageEvent;
}

// ============================================================================
// Channel configuration
// ============================================================================

export interface FeishuChannelConfig {
  appId: string;
  appSecret: string;
  /**
   * Whether to require the bot to be @-mentioned in group chats.
   * P2P messages are always answered. Default: true.
   */
  mentionRequiredInGroup?: boolean;
  /**
   * Receive ID type used when sending. "chat_id" works for both p2p and group
   * (the SDK treats p2p `chat_id` and DM `chat_id` consistently). Default: chat_id.
   */
  receiveIdType?: "chat_id" | "open_id";
  /**
   * Min interval (ms) between successive card PATCH calls. The streamer
   * further backs off on 429. Default: 200.
   */
  cardFlushMs?: number;
  /**
   * Soft cap (bytes) for the streamed card body. Beyond this we collapse the
   * middle of the body. Default: 25_000.
   */
  cardMaxBytes?: number;
  /**
   * Whether to log raw event envelopes to stdout. Off by default (privacy).
   */
  debug?: boolean;
}

// ============================================================================
// Resolved inbound context (output of message-router)
// ============================================================================

/** Result of stripping @-mentions from the user text */
export interface CleanedInbound {
  /** Original event envelope (for ack / reactions / read receipts) */
  envelope: FeishuEventEnvelope;
  /** chat_id from event.message */
  chatId: string;
  /** message_id from event.message */
  messageId: string;
  /** Sender's open_id, used as a per-user session sub-key */
  senderOpenId: string;
  /** "p2p" or "group" */
  chatType: "p2p" | "group";
  /** Cleaned text (mentions stripped, JSON parsed). May be empty string. */
  text: string;
  /** Resolved projectId from session-mapper */
  projectId: string;
  /** Stable sessionId within this chat + sender */
  sessionId: string;
}

// ============================================================================
// Engine adapter — what message-router needs from the host app
// ============================================================================

/**
 * The router does not import PstepEngine directly. The host wires this in at
 * boot, which keeps channels/feishu decoupled from src/engine.
 */
export interface EngineAdapter {
  /**
   * Stream a PstepMessage iterable for the given user input. The router does
   * not care how the engine is implemented — it just iterates.
   *
   * Implementations should:
   *  - Persist the user turn (so message history is durable)
   *  - Return an async iterable that pushes plan / solve / verify / streaming
   *    / tool_call / tool_result / done messages as they happen
   */
  execute(
    text: string,
    projectId: string,
    sessionId: string,
  ): AsyncIterable<PstepMessage>;
}
