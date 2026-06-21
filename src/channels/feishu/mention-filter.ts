/**
 * mention-filter — decide whether to respond and clean up the user text.
 *
 * Rules:
 *  - P2P (DM): always respond.
 *  - Group: respond only if (a) the bot is @-mentioned, or (b) the message
 *    contains `@_all` (treats as a broadcast), unless the channel is
 *    configured to skip the gate (mentionRequiredInGroup === false).
 *  - Strip mention placeholders (@_user_N) from the user text before
 *    sending to the LLM, so it doesn't see literal "@_user_1 hello".
 */

import type { FeishuEventEnvelope, FeishuMention } from "./types.js";

export interface MentionFilterResult {
  /** True if the bot should respond to this event */
  shouldRespond: boolean;
  /** Text with mention placeholders removed; may equal input if no mentions */
  cleanedText: string;
  /** Why the bot decided to respond (or not). Useful for logs / debugging. */
  reason: "p2p" | "bot_mentioned" | "at_all" | "all_in_group" | "skipped_group_no_mention" | "empty_text";
}

export interface MentionFilterOptions {
  mentionRequiredInGroup: boolean;
  /** The bot's own open_id. If null, fall back to "respond to all messages in group". */
  botOpenId: string | null;
}

/**
 * @param envelope  The full event envelope (we read message.mentions, message.content, message.chat_type).
 * @param options   Channel configuration knobs.
 */
export function filterMentions(envelope: FeishuEventEnvelope, options: MentionFilterOptions): MentionFilterResult {
  const msg = envelope.event?.message;
  if (!msg) {
    return { shouldRespond: false, cleanedText: "", reason: "empty_text" };
  }

  // Parse the JSON-stringified content
  let parsed: { text?: string } = {};
  try {
    parsed = JSON.parse(msg.content || "{}");
  } catch {
    parsed = {};
  }
  // Non-text messages (image, file, post, ...) are out of scope for v1.
  if (msg.message_type !== "text" || typeof parsed.text !== "string") {
    return { shouldRespond: false, cleanedText: "", reason: "empty_text" };
  }

  const rawText = parsed.text;
  const mentions: FeishuMention[] = msg.mentions ?? [];

  // Strip mention placeholders. @_user_1 etc. may have a trailing space.
  let cleaned = rawText;
  for (const m of mentions) {
    if (m.key) {
      // Match key plus optional trailing whitespace, globally.
      const re = new RegExp(escapeRegExp(m.key) + "\\s*", "g");
      cleaned = cleaned.replace(re, "");
    }
  }
  cleaned = cleaned.trim();

  // Decision logic
  if (cleaned.length === 0) {
    return { shouldRespond: false, cleanedText: "", reason: "empty_text" };
  }
  if (msg.chat_type === "p2p") {
    return { shouldRespond: true, cleanedText: cleaned, reason: "p2p" };
  }

  // Group chat
  if (!options.mentionRequiredInGroup) {
    return { shouldRespond: true, cleanedText: cleaned, reason: "all_in_group" };
  }

  const atAll = mentions.some((m) => m.key === "@_all");
  if (atAll) {
    return { shouldRespond: true, cleanedText: cleaned, reason: "at_all" };
  }

  if (options.botOpenId) {
    const mentioned = mentions.some((m) => m.id?.open_id === options.botOpenId);
    if (mentioned) {
      return { shouldRespond: true, cleanedText: cleaned, reason: "bot_mentioned" };
    }
  } else {
    // No bot identity available — permissive fallback: respond if the text
    // starts with the literal bot name (cheap heuristic). We avoid this when
    // botOpenId is known.
    // (For v1, we just skip — this is the safe default.)
  }

  return { shouldRespond: false, cleanedText: cleaned, reason: "skipped_group_no_mention" };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
