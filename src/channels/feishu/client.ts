/**
 * FeishuClient — thin wrapper over @larksuiteoapi/node-sdk.
 *
 * Responsibilities:
 *  - Hold the long-lived Lark.Client (used for send / patch messages)
 *  - Hold the Lark.WSClient (used to receive events outbound)
 *  - Cache the bot's own open_id (so message-router can detect @-mentions)
 *  - Provide typed helpers: sendCard(), patchCard()
 *
 * Non-goals:
 *  - No business logic for what to send back (that's card-streamer)
 *  - No routing (that's message-router)
 *  - No state (no sessions, no history)
 */

import * as Lark from "@larksuiteoapi/node-sdk";
import type { FeishuChannelConfig, FeishuEventEnvelope, FeishuMessageEvent } from "./types.js";

const log = (cfg: FeishuChannelConfig, ...args: unknown[]) => {
  if (cfg.debug) {
    // eslint-disable-next-line no-console
    console.log("[feishu]", ...args);
  }
};

export class FeishuClient {
  private readonly sdk: Lark.Client;
  private readonly ws: Lark.WSClient;
  private readonly cfg: FeishuChannelConfig;
  private botOpenId: string | null = null;
  private botAppId: string | null = null;
  private started = false;

  constructor(cfg: FeishuChannelConfig) {
    this.cfg = cfg;
    this.sdk = new Lark.Client({
      appId: cfg.appId,
      appSecret: cfg.appSecret,
      // Use Feishu (China) by default; switch to Lark for international.
      // The SDK uses Domain.Feishu for open.feishu.cn, Domain.Lark for open.larksuite.com.
      domain: Lark.Domain.Feishu,
    });
    this.ws = new Lark.WSClient({
      appId: cfg.appId,
      appSecret: cfg.appSecret,
      domain: Lark.Domain.Feishu,
      loggerLevel: Lark.LoggerLevel.info,
    });
  }

  /** The Lark.Client — for callers that need raw SDK access (tests, future channels) */
  get raw(): Lark.Client {
    return this.sdk;
  }

  /** Cached bot open_id (resolved on first start, may be null until then) */
  get botOpenIdCached(): string | null {
    return this.botOpenId;
  }

  get appIdCached(): string | null {
    return this.botAppId;
  }

  /**
   * Resolve and cache the bot's open_id and app_id.
   * Best-effort: if it fails (e.g. missing contact scope), we still proceed —
   * mention detection will fall back to "respond to all messages in group".
   */
  private async resolveBotIdentity(): Promise<void> {
    try {
      // bot info endpoint
      // The SDK exposes a "bot/v3/info" helper via client.im... actually
      // the canonical path is /open-apis/bot/v3/info — there isn't a typed
      // helper in older SDK versions, so use a manual axios call.
      // For simplicity and to avoid pinning to a specific method that may
      // be renamed, we attempt the typed helper first, then fall back.
      const res = await (this.sdk as any).request({
        method: "GET",
        url: "/open-apis/bot/v3/info",
        params: {},
        data: {},
      });
      const bot = res?.data?.bot ?? res?.bot;
      if (bot) {
        this.botOpenId = bot.open_id ?? null;
        this.botAppId = bot.app_id ?? this.cfg.appId;
      }
      log(this.cfg, "bot identity resolved:", { open_id: this.botOpenId, app_id: this.botAppId });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[feishu] failed to resolve bot identity (mention detection will fall back):", (err as Error).message);
    }
  }

  /**
   * Open the long connection and start dispatching `im.message.receive_v1`
   * to the supplied handler. Returns once WSClient is up.
   */
  async start(handler: (event: FeishuMessageEvent, envelope: FeishuEventEnvelope) => Promise<void> | void): Promise<void> {
    if (this.started) return;
    this.started = true;

    // Best-effort identity resolution; do not block startup on this.
    this.resolveBotIdentity().catch(() => { /* already logged */ });

    const dispatcher = new Lark.EventDispatcher({}).register({
      "im.message.receive_v1": (data: unknown) => {
        // SDK 1.67 EventDispatcher.parse() flattens schema-2.0 events.
        // The flat shape is: { ...header, ...event: { message, sender }, schema }
        // The SDK README confirms: `const { message: { chat_id } } = data;` works.
        const d = data as any;
        const message = d.message;
        const sender = d.sender;
        const header = d.header;
        log(this.cfg, ">>> handler entered, top-level keys:", Object.keys(d).slice(0, 20));
        if (!message) {
          log(this.cfg, "dropped event with no message body:", JSON.stringify(d).slice(0, 200));
          return;
        }
        log(
          this.cfg,
          "inbound message:",
          message.message_id,
          "type:", message.message_type,
          "chat:", message.chat_id,
          "chat_type:", message.chat_type,
        );
        // Build a normalized envelope for downstream code.
        const envelope: FeishuEventEnvelope = {
          schema: d.schema,
          header,
          event: { message, sender },
        };
        try {
          const r = handler(envelope.event, envelope);
          if (r && typeof (r as Promise<unknown>).then === "function") {
            r.catch((err) => {
              // eslint-disable-next-line no-console
              console.error("[feishu] handler error:", err);
            });
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[feishu] handler threw synchronously:", err);
        }
      },
    });

    await this.ws.start({ eventDispatcher: dispatcher });
    log(this.cfg, "WSClient started; listening for im.message.receive_v1");
  }

  // --------------------------------------------------------------------------
  // Outbound helpers
  // --------------------------------------------------------------------------

  /**
   * Send a new interactive card message into a chat. Returns the new
   * `message_id` (used to PATCH the same card later).
   */
  async sendCard(chatId: string, card: object): Promise<string | null> {
    const res = await this.sdk.im.message.create({
      params: { receive_id_type: this.cfg.receiveIdType ?? "chat_id" },
      data: {
        receive_id: chatId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      },
    });
    // SDK normalizes to { code, msg, data: { message_id } }
    const messageId = (res as any)?.data?.message_id ?? null;
    if (!messageId) {
      // eslint-disable-next-line no-console
      console.warn("[feishu] sendCard: no message_id in response:", JSON.stringify(res).slice(0, 200));
    }
    return messageId;
  }

  /**
   * PATCH an already-sent card. `msg_type: "interactive"` is required by the
   * Feishu PATCH endpoint, and `content` is the new stringified card JSON.
   *
   * Returns true on success. On 429 (rate limit) or 230xxx (other business
   * errors), returns false — the caller (CardStreamer) decides whether to
   * back off and retry or fall back to a new message.
   */
  async patchCard(messageId: string, card: object): Promise<PatchResult> {
    try {
      const res = await (this.sdk as any).im.message.patch({
        path: { message_id: messageId },
        data: {
          msg_type: "interactive",
          content: JSON.stringify(card),
        },
      });
      const code = (res as any)?.code;
      if (code !== 0 && code !== undefined) {
        return { ok: false, code, msg: (res as any)?.msg };
      }
      return { ok: true };
    } catch (err: any) {
      // The SDK throws on non-2xx HTTP. Inspect the response payload.
      const response = err?.response?.data ?? err?.data;
      const code = response?.code ?? err?.code;
      const msg = response?.msg ?? err?.message;
      return { ok: false, code, msg };
    }
  }

  /**
   * Add an emoji reaction to a message (e.g. 🤖 while the engine is thinking).
   * Best-effort — failures are logged but not propagated.
   */
  async addReaction(messageId: string, emojiType: string): Promise<void> {
    try {
      await (this.sdk as any).im.messageReaction.create({
        path: { message_id: messageId },
        data: { reaction_type: { emoji_type: emojiType } },
      });
    } catch (err) {
      log(this.cfg, "addReaction failed:", (err as Error).message);
    }
  }
}

export interface PatchResult {
  ok: boolean;
  code?: number;
  msg?: string;
}
