/**
 * message-router — orchestrates one inbound Feishu event:
 *  1. Run mention-filter to decide whether to respond and clean the text
 *  2. Resolve (projectId, sessionId) via session-mapper
 *  3. Spin up a CardStreamer for the chat
 *  4. Iterate the engine's PstepMessage stream, push()ing into the streamer
 *  5. Finalize the streamer on done / error
 *
 * Concurrency: a single FeishuClient can have many in-flight messages
 * (different chats, different users). The router does not serialize them —
 * each one gets its own CardStreamer instance, and PATCHes are scoped to
 * the streamer (per message_id). If the host wants to bound concurrency
 * per chat, it can wrap the adapter in a semaphore.
 */

import { FeishuClient } from "./client.js";
import { CardStreamer } from "./card-streamer.js";
import { filterMentions } from "./mention-filter.js";
import { SessionMapper } from "./session-mapper.js";
import type { FeishuChannelConfig, FeishuEventEnvelope, EngineAdapter } from "./types.js";

export interface MessageRouterDeps {
  client: FeishuClient;
  engine: EngineAdapter;
  sessionMapper: SessionMapper;
  config: FeishuChannelConfig;
}

export class MessageRouter {
  constructor(private readonly deps: MessageRouterDeps) {}

  async handle(envelope: FeishuEventEnvelope): Promise<void> {
    const { client, engine, sessionMapper, config } = this.deps;

    // 1) Mention gate + text cleaning
    const mention = filterMentions(envelope, {
      mentionRequiredInGroup: config.mentionRequiredInGroup ?? true,
      botOpenId: client.botOpenIdCached,
    });
    if (!mention.shouldRespond) {
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.log(`[feishu:router] skip chat=${envelope.event.message?.chat_id} reason=${mention.reason}`);
      }
      return;
    }

    const msg = envelope.event.message;
    const sender = envelope.event.sender;
    const chatId = msg.chat_id;
    const messageId = msg.message_id;
    const senderOpenId = sender.sender_id?.open_id ?? "unknown";

    // 2) Resolve session
    const { projectId, sessionId } = sessionMapper.resolve(chatId, senderOpenId);

    // 3) Spin up a streamer and ship the initial "thinking" card
    let streamer: CardStreamer | null = null;
    try {
      streamer = new CardStreamer(client, chatId, {
        cardFlushMs: config.cardFlushMs ?? 200,
        cardMaxBytes: config.cardMaxBytes ?? 25_000,
        debug: config.debug,
      });
      await streamer.start();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[feishu:router] failed to start card streamer for chat=${chatId}:`, (err as Error).message);
      // Best-effort fallback: send a plain text "engine starting" message
      // so the user knows we received their input but couldn't initialize.
      try {
        await client.sendCard(chatId, {
          config: { wide_screen_mode: true },
          header: { title: { tag: "plain_text", content: "⚠️ 启动失败" }, template: "red" },
          elements: [{ tag: "markdown", content: `**启动回复卡片失败**\n\n\`${(err as Error).message}\`` }],
        });
      } catch {
        /* swallow */
      }
      return;
    }

    // 4) Iterate the engine stream
    let finalSummary: string | undefined;
    try {
      for await (const pmsg of engine.execute(mention.cleanedText, projectId, sessionId)) {
        streamer.push(pmsg);
        if (pmsg.type === "done") {
          finalSummary = (pmsg as { summary?: string }).summary;
        }
      }
      await streamer.finalize(finalSummary);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[feishu:router] engine error chat=${chatId} msg=${messageId}:`, (err as Error).message);
      await streamer.failWith("Engine 执行失败", (err as Error).message);
    }
  }
}
