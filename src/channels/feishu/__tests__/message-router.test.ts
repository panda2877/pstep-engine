/**
 * Tests for channels/feishu/message-router.ts
 *
 * Uses stub client + a fake engine that yields a pre-canned PstepMessage
 * stream. Covers: mention gate end-to-end, session mapping, final summary
 * extraction, error fallback to error card.
 */

import { describe, it, expect, vi } from "vitest";
import { MessageRouter } from "../message-router.js";
import { SessionMapper } from "../session-mapper.js";
import type { FeishuClient, PatchResult } from "../client.js";
import type { FeishuEventEnvelope, FeishuChannelConfig, EngineAdapter } from "../types.js";
import type { PstepMessage } from "../../../types/messages.js";

function stubClient() {
  const sendCard = vi.fn(async () => "msg_test_1");
  const patchCard = vi.fn(async (): Promise<PatchResult> => ({ ok: true }));
  const addReaction = vi.fn(async () => {});
  return {
    sendCard,
    patchCard,
    addReaction,
    client: { sendCard, patchCard, addReaction, botOpenIdCached: "ou_bot" } as unknown as FeishuClient,
  };
}

function envelope(text: string, opts?: { chatType?: "p2p" | "group"; senderOpenId?: string; botMentioned?: boolean }): FeishuEventEnvelope {
  const chatType = opts?.chatType ?? "p2p";
  const mentions = opts?.botMentioned ? [{ key: "@_user_1", id: { open_id: "ou_bot" }, name: "bot" }] : [];
  return {
    schema: "2.0",
    header: { event_type: "im.message.receive_v1" },
    event: {
      message: {
        message_id: "m_1",
        chat_id: "oc_chat_1",
        chat_type: chatType,
        message_type: "text",
        content: JSON.stringify({ text: opts?.botMentioned ? "@_user_1 " + text : text }),
        mentions,
      },
      sender: { sender_id: { open_id: opts?.senderOpenId ?? "ou_user_1" }, sender_type: "user" },
    },
  };
}

function fakeEngine(messages: PstepMessage[]): EngineAdapter & { calls: Array<{ text: string; projectId: string; sessionId: string }> } {
  const calls: Array<{ text: string; projectId: string; sessionId: string }> = [];
  return {
    calls,
    async *execute(text: string, projectId: string, sessionId: string): AsyncIterable<PstepMessage> {
      calls.push({ text, projectId, sessionId });
      for (const m of messages) yield m;
    },
  };
}

const baseConfig: FeishuChannelConfig = {
  appId: "cli_x",
  appSecret: "x",
  mentionRequiredInGroup: true,
  cardFlushMs: 50,
  cardMaxBytes: 25_000,
};

describe("MessageRouter", () => {
  it("P2P happy path: engine called, streaming messages pushed, finalize PATCH sent", async () => {
    const { client, sendCard, patchCard } = stubClient();
    const engine = fakeEngine([
      { id: "s1", role: "assistant", createdAt: 0, type: "streaming", content: "the answer", isPartial: true },
      { id: "d1", role: "assistant", createdAt: 0, type: "done", sessionId: "x", messageCount: 1, totalSteps: 0, completedSteps: 0, summary: "answered" },
    ]);
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper(),
      config: baseConfig,
    });
    await router.handle(envelope("what is 2+2?"));
    expect(engine.calls).toHaveLength(1);
    expect(engine.calls[0].text).toBe("what is 2+2?");
    expect(engine.calls[0].projectId).toBe("feishu:oc_chat_1");
    expect(engine.calls[0].sessionId).toBe("oc_chat_1:ou_user_1");
    expect(sendCard).toHaveBeenCalledTimes(1); // initial thinking card
    // The streamer's mid-stream flush and the finalize flush may overlap
    // depending on timing. At minimum, the finalize PATCH must have fired.
    // With cardFlushMs=50 (from baseConfig), if the engine yields synchronously,
    // finalize cancels the pending mid-stream timer — so we get exactly 1 PATCH
    // (the finalize card). This is correct behavior: no stale mid-stream card
    // is sent after the final card.
    expect(patchCard.mock.calls.length).toBeGreaterThanOrEqual(1);
    // Verify it's the final card (green header = done)
    const lastCall = patchCard.mock.calls[patchCard.mock.calls.length - 1] as unknown as [string, any];
    expect(lastCall?.[1]?.header?.template).toBe("green");
  });

  it("Group without mention: engine NOT called, NO PATCHes", async () => {
    const { client, sendCard, patchCard } = stubClient();
    const engine = fakeEngine([]);
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper(),
      config: baseConfig,
    });
    await router.handle(envelope("casual chat", { chatType: "group" }));
    expect(engine.calls).toHaveLength(0);
    expect(sendCard).not.toHaveBeenCalled();
    expect(patchCard).not.toHaveBeenCalled();
  });

  it("Group with @bot: mention stripped before engine call", async () => {
    const { client } = stubClient();
    const engine = fakeEngine([
      { id: "d1", role: "assistant", createdAt: 0, type: "done", sessionId: "x", messageCount: 0, totalSteps: 0, completedSteps: 0, summary: "ok" },
    ]);
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper(),
      config: baseConfig,
    });
    await router.handle(envelope("帮我看下", { chatType: "group", botMentioned: true }));
    expect(engine.calls[0].text).toBe("帮我看下"); // @_user_1 stripped
  });

  it("Static session map (FEISHU_CHAT_PROJECT_MAP) routes to a custom project", async () => {
    const { client } = stubClient();
    const engine = fakeEngine([
      { id: "d1", role: "assistant", createdAt: 0, type: "done", sessionId: "x", messageCount: 0, totalSteps: 0, completedSteps: 0, summary: "ok" },
    ]);
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper("oc_chat_1:p_special"),
      config: baseConfig,
    });
    await router.handle(envelope("hi"));
    expect(engine.calls[0].projectId).toBe("p_special");
  });

  it("Different senders in same chat get different sessions but same project", async () => {
    const { client } = stubClient();
    const engine = fakeEngine([
      { id: "d1", role: "assistant", createdAt: 0, type: "done", sessionId: "x", messageCount: 0, totalSteps: 0, completedSteps: 0, summary: "ok" },
    ]);
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper("oc_chat_1:p_special"),
      config: baseConfig,
    });
    await router.handle(envelope("from A", { senderOpenId: "ou_A" }));
    await router.handle(envelope("from B", { senderOpenId: "ou_B" }));
    expect(engine.calls[0].sessionId).toBe("oc_chat_1:ou_A");
    expect(engine.calls[1].sessionId).toBe("oc_chat_1:ou_B");
    expect(engine.calls[0].projectId).toBe("p_special");
    expect(engine.calls[1].projectId).toBe("p_special");
  });

  it("Engine throws: failWith() is called, error card is the last PATCH", async () => {
    const { client, patchCard } = stubClient();
    const engine: EngineAdapter = {
      async *execute(): AsyncIterable<PstepMessage> {
        throw new Error("LLM gateway unreachable");
        // eslint-disable-next-line no-unreachable
        yield* [];
      },
    };
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper(),
      config: baseConfig,
    });
    await router.handle(envelope("hi"));
    // Last PATCH should be an error card (red header)
    const lastCall = patchCard.mock.calls[patchCard.mock.calls.length - 1] as unknown as [string, any] | undefined;
    const card = lastCall?.[1];
    expect(card?.header?.template).toBe("red");
  });

  it("Engine yields done mid-stream: final summary is passed to finalize()", async () => {
    const { client, patchCard } = stubClient();
    const engine = fakeEngine([
      { id: "s1", role: "assistant", createdAt: 0, type: "streaming", content: "ans", isPartial: true },
      { id: "d1", role: "assistant", createdAt: 0, type: "done", sessionId: "x", messageCount: 1, totalSteps: 0, completedSteps: 0, summary: "MY_SUMMARY" },
    ]);
    const router = new MessageRouter({
      client,
      engine,
      sessionMapper: new SessionMapper(),
      config: baseConfig,
    });
    await router.handle(envelope("hi"));
    const lastCall = patchCard.mock.calls[patchCard.mock.calls.length - 1] as unknown as [string, any] | undefined;
    const card = lastCall?.[1];
    const summary = card?.elements?.find((e: any) => e.tag === "markdown" && e.content.includes("MY_SUMMARY"));
    expect(summary).toBeTruthy();
  });
});
