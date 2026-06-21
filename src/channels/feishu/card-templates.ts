/**
 * card-templates — Card 2.0 JSON factories.
 *
 * All cards:
 *  - Use `config.wide_screen_mode: true` for nicer desktop layout
 *  - Use `config.update_multi: true` so PATCH /im/v1/messages/{id} works
 *    repeatedly (Feishu requires this flag to update the same card > 1 time)
 *  - Use `tag: "markdown"` elements (the Card 2.0 native form, not the
 *    legacy `div` + `lark_md` form)
 *
 * Card types:
 *  - thinkingCard(): shown at the start, "🧠 思考中…"
 *  - streamingCard(body, steps, meta): updated on every token chunk
 *  - finalCard(body, steps, meta): shown when the engine emits "done"
 *  - errorCard(msg): shown when the engine throws
 */

import type { PlanStep } from "../../types/messages.js";

const HEADER_BLUE = "blue";
const HEADER_GREEN = "green";
const HEADER_RED = "red";
const HEADER_ORANGE = "orange";

function baseConfig(): { wide_screen_mode: boolean; update_multi: boolean } {
  return { wide_screen_mode: true, update_multi: true };
}

function header(title: string, template: string) {
  return {
    title: { tag: "plain_text" as const, content: title },
    template,
  };
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Initial thinking card
// ---------------------------------------------------------------------------

export function thinkingCard(startedAt: number): object {
  return {
    config: baseConfig(),
    header: header("🧠 思考中…", HEADER_BLUE),
    elements: [
      { tag: "markdown", content: `_正在分析你的问题…_\n\n⏱ Started: ${formatTime(startedAt)}` },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mid-stream card (updated frequently)
// ---------------------------------------------------------------------------

export interface StreamingCardMeta {
  durationMs?: number;
  /** Approximate token count, if known. Otherwise undefined. */
  tokens?: number;
}

export function streamingCard(body: string, steps: PlanStep[] = [], meta?: StreamingCardMeta): object {
  return {
    config: baseConfig(),
    header: header("✨ 生成中", HEADER_BLUE),
    elements: [
      { tag: "markdown", content: body || "_(no content yet)_" },
      ...stepsSection(steps),
      ...metaFooter(meta),
    ],
  };
}

// ---------------------------------------------------------------------------
// Final card (when engine emits "done")
// ---------------------------------------------------------------------------

export function finalCard(body: string, steps: PlanStep[] = [], meta?: StreamingCardMeta & { summary?: string }): object {
  return {
    config: baseConfig(),
    header: header("✅ 完成", HEADER_GREEN),
    elements: [
      ...(meta?.summary ? [{ tag: "markdown" as const, content: `**Summary**\n${meta.summary}` }, { tag: "hr" as const }] : []),
      { tag: "markdown", content: body || "_(empty response)_" },
      ...stepsSection(steps),
      ...metaFooter(meta),
    ],
  };
}

// ---------------------------------------------------------------------------
// Error card
// ---------------------------------------------------------------------------

export function errorCard(message: string, detail?: string): object {
  return {
    config: baseConfig(),
    header: header("❌ 出错了", HEADER_RED),
    elements: [
      { tag: "markdown", content: `**${message}**\n\n${detail ?? ""}`.trim() },
    ],
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stepsSection(steps: PlanStep[]): object[] {
  if (!steps.length) return [];
  const lines = steps.map((s) => {
    const icon = s.status === "completed" ? "✅" : s.status === "failed" ? "❌" : s.status === "in_progress" ? "🔄" : "⏳";
    return `${icon} **${s.title}** — ${s.description}`;
  });
  return [
    { tag: "hr" as const },
    { tag: "collapsible_notes" as const, fields: lines.map((content) => ({ tag: "plain_text" as const, content })) },
  ];
}

function metaFooter(meta?: StreamingCardMeta): object[] {
  if (!meta) return [];
  const parts: string[] = [];
  if (typeof meta.durationMs === "number") parts.push(`思考耗时 ${formatDuration(meta.durationMs)}`);
  if (typeof meta.tokens === "number") parts.push(`${meta.tokens} tokens`);
  if (!parts.length) return [];
  return [
    { tag: "hr" as const },
    { tag: "note" as const, elements: [{ tag: "plain_text" as const, content: parts.join(" · ") }] },
  ];
}
