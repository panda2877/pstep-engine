/**
 * Tests for channels/feishu/card-streamer.ts
 *
 * Uses an injected stub FeishuClient so no real network is touched.
 * Covers: start, push (streaming + plan), finalize, failWith, throttle,
 * 25KB truncation, 429 backoff, in-flight coalescing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CardStreamer } from "../card-streamer.js";
import type { PatchResult, FeishuClient } from "../client.js";
import type { PstepMessage, PlanStep, StreamingMessage, DoneMessage } from "../../../types/messages.js";

// A stub FeishuClient that satisfies the CardStreamer's surface without
// actually instantiating @larksuiteoapi/node-sdk.
function makeStubClient(overrides?: {
  patchImpl?: (msgId: string, card: any) => Promise<PatchResult>;
  patchDelays?: number[];
}) {
  const sendCard = vi.fn(async (_chatId: string) => "msg_test_1");
  const patchCard = vi.fn(async (msgId: string, _card: any): Promise<PatchResult> => {
    if (overrides?.patchImpl) return overrides.patchImpl(msgId, _card);
    return { ok: true };
  });
  const addReaction = vi.fn(async () => {});
  // Cast: CardStreamer only uses sendCard / patchCard / addReaction.
  return { sendCard, patchCard, addReaction, client: { sendCard, patchCard, addReaction } as unknown as FeishuClient };
}

function streamingMessage(content: string, partial = true): StreamingMessage {
  return {
    id: "s1",
    role: "assistant",
    createdAt: 0,
    type: "streaming",
    content,
    isPartial: partial,
  };
}

function planMessage(steps: PlanStep[]): PstepMessage {
  return {
    id: "p1",
    role: "assistant",
    createdAt: 0,
    type: "plan",
    content: "plan",
    steps,
    totalSteps: steps.length,
  };
}

function doneMessage(summary: string): DoneMessage {
  return {
    id: "d1",
    role: "assistant",
    createdAt: 0,
    type: "done",
    sessionId: "sess",
    messageCount: 1,
    totalSteps: 0,
    completedSteps: 0,
    summary,
  };
}

describe("CardStreamer", () => {
  // Real timers (the streamer uses queueMicrotask + setTimeout); fake timers
  // don't pump microtasks the way we need. We use small real delays.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("start() calls sendCard and captures the message_id", async () => {
    const { client, sendCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 200, cardMaxBytes: 25_000 });
    await s.start();
    expect(sendCard).toHaveBeenCalledTimes(1);
    expect(s.hasMessageId).toBe(true);
  });

  it("push() before start() is a no-op (no PATCH)", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 200, cardMaxBytes: 25_000 });
    s.push(streamingMessage("hello"));
    await sleep(300);
    expect(patchCard).not.toHaveBeenCalled();
  });

  it("push() after start() schedules a PATCH within minIntervalMs", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 200, cardMaxBytes: 25_000 });
    await s.start();
    s.push(streamingMessage("hello world"));
    // microtask + setTimeout(0) for the schedule
    await sleep(50);
    // Fire any pending timers
    await sleep(300);
    expect(patchCard).toHaveBeenCalled();
    // The card content is the streaming body
    const cardArg = patchCard.mock.calls[0]?.[1] as any;
    const markdown = cardArg?.elements?.find((e: any) => e.tag === "markdown");
    expect(markdown?.content).toContain("hello world");
  });

  it("aggregates streaming messages (longer content wins)", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 50, cardMaxBytes: 25_000 });
    await s.start();
    s.push(streamingMessage("first"));
    s.push(streamingMessage("first chunk then more"));
    s.push(streamingMessage("short")); // shorter, should NOT overwrite
    await sleep(150);
    const cardArg = patchCard.mock.calls.at(-1)?.[1] as any;
    const markdown = cardArg?.elements?.find((e: any) => e.tag === "markdown");
    expect(markdown?.content).toBe("first chunk then more");
  });

  it("plan message populates the step ledger (collapsible_notes section)", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 50, cardMaxBytes: 25_000 });
    await s.start();
    const step: PlanStep = { id: "s1", title: "t", description: "d", status: "pending", dependencies: [], createdAt: 0 };
    s.push(planMessage([step]));
    await sleep(150);
    const cardArg = patchCard.mock.calls.at(-1)?.[1] as any;
    expect(cardArg.elements.some((e: any) => e.tag === "collapsible_notes")).toBe(true);
  });

  it("25KB truncation kicks in when body exceeds cardMaxBytes", async () => {
    const { client, patchCard } = makeStubClient();
    // 1KB cap so we don't need a 25KB string in the test
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 50, cardMaxBytes: 1024 });
    await s.start();
    const huge = "x".repeat(2000);
    s.push(streamingMessage(huge));
    await sleep(150);
    const cardArg = patchCard.mock.calls.at(-1)?.[1] as any;
    const markdown = cardArg.elements.find((e: any) => e.tag === "markdown");
    // Body should now contain the truncation marker
    expect(markdown.content).toContain("… (content truncated) …");
    // And the resulting string is bounded
    const outBytes = Buffer.byteLength(markdown.content, "utf8");
    expect(outBytes).toBeLessThanOrEqual(1024 + 50); // small slack for marker
  });

  it("429 from patchCard bumps backoff (next PATCH is delayed further)", async () => {
    let calls = 0;
    const { client, patchCard } = makeStubClient({
      patchImpl: async () => {
        calls++;
        return calls === 1 ? { ok: false, code: 230020, msg: "rate limit" } : { ok: true };
      },
    });
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 100, cardMaxBytes: 25_000 });
    await s.start();
    s.push(streamingMessage("a"));
    await sleep(180);
    // First PATCH: 429
    expect(patchCard).toHaveBeenCalledTimes(1);
    // Wait only 100ms — should NOT have flushed again (backoff now 500ms,
    // so total interval = 100 + 500 = 600ms)
    await sleep(150);
    expect(patchCard).toHaveBeenCalledTimes(1);
    // Wait the backoff window
    await sleep(800);
    expect(patchCard).toHaveBeenCalledTimes(2);
  });

  it("finalize() emits a final PATCH (green header)", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 200, cardMaxBytes: 25_000 });
    await s.start();
    s.push(streamingMessage("the answer is 42"));
    await s.finalize("answered");
    const cardArg = patchCard.mock.calls.at(-1)?.[1] as any;
    expect(cardArg.header.template).toBe("green");
    expect(cardArg.header.title.content).toContain("完成");
  });

  it("failWith() emits a red error card", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 200, cardMaxBytes: 25_000 });
    await s.start();
    await s.failWith("Engine failed", "stack trace here");
    const cardArg = patchCard.mock.calls.at(-1)?.[1] as any;
    expect(cardArg.header.template).toBe("red");
    const md = cardArg.elements.find((e: any) => e.tag === "markdown");
    expect(md.content).toContain("Engine failed");
  });

  it("push() after finalize() is a no-op (no further PATCHes)", async () => {
    const { client, patchCard } = makeStubClient();
    const s = new CardStreamer(client, "oc_chat", { cardFlushMs: 50, cardMaxBytes: 25_000 });
    await s.start();
    s.push(streamingMessage("first"));
    await sleep(100);
    await s.finalize();
    const before = patchCard.mock.calls.length;
    s.push(streamingMessage("ignored"));
    await sleep(300);
    expect(patchCard.mock.calls.length).toBe(before); // no new PATCH
  });
});
