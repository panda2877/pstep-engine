/**
 * card-streamer — turns the engine's PstepMessage stream into a Feishu card
 * that updates in real time, with rate-limit-aware throttling.
 *
 * Lifecycle of a single inbound user message:
 *  1. start() — send the initial "thinking" card, get back a message_id
 *  2. push(msg) — accumulate content from the engine stream; throttle PATCH
 *     to respect Feishu's per-message rate limit (reported 5 QPS or 50 QPS,
 *     we treat 5/s as the safer floor and back off on 429)
 *  3. finalize() — emit the final card, mark closed (no more PATCH after)
 *
 * Throttling strategy:
 *  - `minIntervalMs` (default 200ms) is the floor between PATCHes
 *  - On 429, back off: add 500ms to `backoffMs`, capped at 2000ms
 *  - On success, decay: subtract 50ms from `backoffMs` per success, floor 0
 *  - Effective interval = minIntervalMs + backoffMs
 *
 * Body size cap:
 *  - `maxBytes` (default 25_000) keeps the markdown body under Feishu's
 *    ~30KB PATCH limit. When we exceed, keep the first 1/3 and the last 2/3
 *    of the body, joined by a "\n\n_… (content truncated) …_\n\n" marker.
 *
 * Failure modes handled:
 *  - sendCard fails at start() → constructor throws, caller falls back
 *  - patchCard returns 429 → backoff, retry once on next tick
 *  - patchCard returns other non-ok code → log + skip (do not crash the
 *    whole request). The user will see the last successfully-PATCHed state.
 *  - patchCard throws (network) → log + skip
 */

import { FeishuClient, type PatchResult } from "./client.js";
import { thinkingCard, streamingCard, finalCard, errorCard, type StreamingCardMeta } from "./card-templates.js";
import type { PstepMessage, PlanStep, StreamingMessage, SolveMessage, ToolCallMessage, ToolResultMessage, VerifyMessage, DoneMessage } from "../../types/messages.js";

const TRUNCATION_MARKER = "\n\n_… (content truncated) …_\n\n";
const TRUNCATION_KEEP_HEAD_RATIO = 1 / 3;

export interface CardStreamerOptions {
  cardFlushMs: number;
  cardMaxBytes: number;
  debug?: boolean;
}

export class CardStreamer {
  private readonly client: FeishuClient;
  private readonly chatId: string;
  private readonly opts: Required<CardStreamerOptions>;

  private messageId: string | null = null;
  private started = false;
  private closed = false;

  // Body buffer
  private buf = "";
  // Plan / Solve / Verify step ledger (latest status for each stepId)
  private steps = new Map<string, PlanStep>();
  private stepOrder: string[] = [];
  private meta: StreamingCardMeta = {};

  // Throttle state
  private lastFlushAt = 0;
  private backoffMs = 0;
  private inFlight = false;
  private pendingTimer: NodeJS.Timeout | null = null;
  private pendingDirty = false;
  private flushCount = 0;
  private lastSuccessAt = 0;

  // Timing
  private readonly startedAt: number;

  constructor(client: FeishuClient, chatId: string, opts: CardStreamerOptions) {
    this.client = client;
    this.chatId = chatId;
    this.opts = {
      cardFlushMs: opts.cardFlushMs,
      cardMaxBytes: opts.cardMaxBytes,
      debug: opts.debug ?? false,
    };
    this.startedAt = Date.now();
  }

  /** Whether the initial card was sent successfully */
  get hasMessageId(): boolean {
    return this.messageId !== null;
  }

  /**
   * Send the initial "thinking" card. Must be called once before any push()
   * or finalize() call. Throws if the send fails (the caller can then fall
   * back to a plain text message).
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const messageId = await this.client.sendCard(this.chatId, thinkingCard(this.startedAt));
    if (!messageId) {
      throw new Error("[feishu] CardStreamer.start: sendCard returned no message_id");
    }
    this.messageId = messageId;
    this.lastFlushAt = Date.now();
    this.debug("started, messageId=", messageId);
  }

  /**
   * Feed one PstepMessage from the engine stream. Aggregates into buf / steps
   * and schedules a PATCH. Safe to call before start() (no-op until started).
   */
  push(msg: PstepMessage): void {
    if (this.closed) return;
    this.applyToBuffer(msg);
    this.applyToSteps(msg);
    this.scheduleFlush();
  }

  /**
   * Mark the stream as finished. Emits a final "done" card (if start()
   * succeeded) and prevents further PATCHes. After this, push() is a no-op.
   *
   * Always performs a final PATCH with the "done" card. If a throttled
   * mid-stream PATCH is still pending, it is cancelled so the user sees
   * exactly the final state (no risk of a mid-stream card overwriting the
   * final one with stale content).
   */
  async finalize(finalSummary?: string): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    // Wait for any in-flight PATCH to settle, so we don't race against
    // a stale mid-stream write.
    if (this.inFlight) {
      const start = Date.now();
      while (this.inFlight && Date.now() - start < 2000) {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
    if (!this.messageId) {
      this.debug("finalize: no messageId, skipping final PATCH");
      return;
    }
    const durationMs = Date.now() - this.startedAt;
    this.meta = { ...this.meta, durationMs };
    try {
      const card = finalCard(this.buf, this.currentSteps(), {
        ...this.meta,
        summary: finalSummary,
      });
      await this.client.patchCard(this.messageId, card);
      this.debug("finalize: final card PATCHed");
    } catch (err) {
      this.debug("finalize: final PATCH failed:", (err as Error).message);
    }
  }

  /**
   * Convert an error into an error card (replaces the in-flight card).
   * Idempotent with finalize() — last one wins.
   */
  async failWith(message: string, detail?: string): Promise<void> {
    this.closed = true;
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    if (!this.messageId) {
      this.debug("failWith: no messageId, skipping");
      return;
    }
    try {
      const card = errorCard(message, detail);
      await this.client.patchCard(this.messageId, card);
      this.debug("failWith: error card PATCHed");
    } catch (err) {
      this.debug("failWith: error PATCH failed:", (err as Error).message);
    }
  }

  // --------------------------------------------------------------------------
  // Internal: buffer / step aggregation
  // --------------------------------------------------------------------------

  private applyToBuffer(msg: PstepMessage): void {
    switch (msg.type) {
      case "streaming":
        // The orchestrator sends incremental `StreamingMessage` whose
        // `content` is the *cumulative* text from the LLM. We treat later
        // messages as supersets of earlier ones; dedupe by comparing to buf.
        {
          const m = msg as StreamingMessage;
          const incoming = m.content ?? "";
          if (incoming.length > this.buf.length) {
            this.buf = incoming;
          }
        }
        break;
      case "solve":
        {
          const m = msg as SolveMessage;
          // Append the step's content as a sub-section if not already present.
          const block = `\n\n**Step ${m.stepNumber}** · ${m.content}${m.result ? `\n\n${m.result}` : ""}`;
          if (!this.buf.includes(block)) this.buf = (this.buf + block).slice(0, this.opts.cardMaxBytes * 2);
        }
        break;
      case "verify":
        {
          const m = msg as VerifyMessage;
          this.buf = `${this.buf}\n\n**Verify step ${m.stepNumber}** — ${m.status}\n${m.feedback}`.slice(0, this.opts.cardMaxBytes * 2);
        }
        break;
      case "tool_call":
        {
          const m = msg as ToolCallMessage;
          this.buf = `${this.buf}\n\n🔧 \`${m.toolName}\`(${summarizeArgs(m.args)})`.slice(0, this.opts.cardMaxBytes * 2);
        }
        break;
      case "tool_result":
        {
          const m = msg as ToolResultMessage;
          const icon = m.isError ? "⚠️" : "↩";
          this.buf = `${this.buf}\n${icon} ${m.result}`.slice(0, this.opts.cardMaxBytes * 2);
        }
        break;
      case "plan":
      case "done":
        // Aggregated via steps / finalize; nothing to add to body.
        break;
    }
  }

  private applyToSteps(msg: PstepMessage): void {
    if (msg.type === "plan") {
      // Replace the step ledger wholesale.
      this.steps.clear();
      this.stepOrder = [];
      for (const s of (msg as { steps: PlanStep[] }).steps) {
        this.steps.set(s.id, { ...s });
        this.stepOrder.push(s.id);
      }
    } else if (msg.type === "solve" || msg.type === "verify") {
      const m = msg as SolveMessage | VerifyMessage;
      if (m.stepId && this.steps.has(m.stepId)) {
        const prev = this.steps.get(m.stepId)!;
        this.steps.set(m.stepId, {
          ...prev,
          status: msg.type === "verify" ? mapVerifyStatus((m as VerifyMessage).status) : "in_progress",
          completedAt: msg.type === "verify" ? Date.now() : prev.completedAt,
        });
      }
    } else if (msg.type === "done") {
      const m = msg as DoneMessage;
      // Mark all steps as completed (or failed, but engine doesn't tell us).
      for (const id of this.stepOrder) {
        const s = this.steps.get(id);
        if (s && s.status !== "completed") {
          this.steps.set(id, { ...s, status: "completed", completedAt: Date.now() });
        }
      }
      if (typeof m.summary === "string") this.meta = { ...this.meta, tokens: undefined };
    }
  }

  private currentSteps(): PlanStep[] {
    return this.stepOrder.map((id) => this.steps.get(id)!).filter(Boolean);
  }

  // --------------------------------------------------------------------------
  // Internal: throttling and PATCH
  // --------------------------------------------------------------------------

  private scheduleFlush(): void {
    if (this.closed) return;
    if (!this.messageId) return;
    if (this.inFlight) {
      this.pendingDirty = true;
      return;
    }

    const interval = this.opts.cardFlushMs + this.backoffMs;
    const elapsed = Date.now() - this.lastFlushAt;
    const delay = Math.max(0, interval - elapsed);

    if (delay === 0) {
      // Fire on next microtask so callers can batch multiple push()es.
      queueMicrotask(() => this.flushNow());
    } else {
      if (this.pendingTimer) return; // already scheduled
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null;
        this.flushNow();
      }, delay);
    }
  }

  private async flushNow(): Promise<void> {
    if (this.closed || this.inFlight || !this.messageId) return;
    this.inFlight = true;
    this.pendingDirty = false;

    const card = streamingCard(this.truncate(this.buf), this.currentSteps(), this.meta);
    const t0 = Date.now();
    let result: PatchResult;
    try {
      result = await this.client.patchCard(this.messageId, card);
    } catch (err) {
      // The client.patchCard catches and returns PatchResult, so this is
      // unexpected. Log and treat as failure.
      this.debug("flushNow threw:", (err as Error).message);
      result = { ok: false, msg: (err as Error).message };
    }
    const dt = Date.now() - t0;

    this.lastFlushAt = Date.now();
    this.flushCount++;

    if (result.ok) {
      this.lastSuccessAt = this.lastFlushAt;
      this.backoffMs = Math.max(0, this.backoffMs - 50);
    } else {
      // 429 → exponential-ish backoff; other → mild backoff
      const isRateLimit = result.code === 230020 || result.code === 99991400 || /rate.?limit/i.test(result.msg ?? "");
      if (isRateLimit) {
        this.backoffMs = Math.min(2000, this.backoffMs + 500);
      } else {
        this.backoffMs = Math.min(1000, this.backoffMs + 200);
      }
      this.debug(`PATCH failed code=${result.code} msg=${result.msg} → backoff=${this.backoffMs}ms (dt=${dt}ms)`);
    }

    this.inFlight = false;

    // Always re-schedule after a flush:
    //  - If push()es arrived during the in-flight window, retry to flush them.
    //  - If the PATCH failed, retry with the (now larger) backoff.
    //  - If the PATCH succeeded, retry only if push()es came in (handled by
    //    pendingDirty). Otherwise, stay idle.
    if (!this.closed) {
      if (this.pendingDirty) {
        this.scheduleFlush();
      } else if (!result.ok) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Truncate the body to fit under `maxBytes`. Keeps the first third and the
   * last two-thirds, joined by a TRUNCATION_MARKER. UTF-8 safe via Buffer.
   */
  private truncate(body: string): string {
    const buf = Buffer.from(body, "utf8");
    if (buf.byteLength <= this.opts.cardMaxBytes) return body;

    const headLen = Math.floor(this.opts.cardMaxBytes * TRUNCATION_KEEP_HEAD_RATIO);
    const tailLen = this.opts.cardMaxBytes - headLen - Buffer.byteLength(TRUNCATION_MARKER, "utf8");
    const headBytes = buf.subarray(0, headLen);
    const tailBytes = buf.subarray(buf.byteLength - tailLen);
    // Decode back to strings. Subarray is a view; toString('utf8') won't crash
    // on a partial multi-byte char (it replaces with U+FFFD), which is fine
    // for our use case.
    return headBytes.toString("utf8") + TRUNCATION_MARKER + tailBytes.toString("utf8");
  }

  private debug(...args: unknown[]): void {
    if (this.opts.debug) {
      // eslint-disable-next-line no-console
      console.log(`[feishu:streamer chat=${this.chatId} msg=${this.messageId ?? "?"}]`, ...args);
    }
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function mapVerifyStatus(s: "pass" | "fail" | "needs_revision"): PlanStep["status"] {
  if (s === "pass") return "completed";
  if (s === "fail") return "failed";
  return "in_progress";
}

function summarizeArgs(args: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 80 ? s.slice(0, 77) + "..." : s;
  } catch {
    return "{...}";
  }
}
