/**
 * Tests for channels/feishu/mention-filter.ts
 *
 * Covers the four routing decisions:
 *  - P2P (DM): always respond, strip nothing (no mention placeholders in DM)
 *  - Group + bot @-mentioned: respond, strip the @-placeholder from text
 *  - Group + @_all: respond, strip
 *  - Group + no mention: skip (silently ACK)
 *  - Group with mentionRequiredInGroup === false: respond to all (no strip)
 *  - Non-text message types (image / post / etc.): skip
 *  - Empty / whitespace-only text: skip
 */

import { describe, it, expect } from "vitest";
import { filterMentions } from "../mention-filter.js";
import type { FeishuEventEnvelope, FeishuMessage, FeishuSender } from "../types.js";

function envelope(opts: {
  chatType: "p2p" | "group";
  text: string;
  mentions?: Array<{ key: string; open_id?: string; name?: string }>;
  messageType?: string;
  senderOpenId?: string;
}): FeishuEventEnvelope {
  const message: FeishuMessage = {
    message_id: "m_1",
    chat_id: "oc_test",
    chat_type: opts.chatType,
    message_type: opts.messageType ?? "text",
    content: JSON.stringify({ text: opts.text }),
    mentions: opts.mentions?.map((m) => ({ key: m.key, id: { open_id: m.open_id }, name: m.name })),
  };
  const sender: FeishuSender = {
    sender_id: { open_id: opts.senderOpenId ?? "ou_user" },
    sender_type: "user",
  };
  return { schema: "2.0", header: { event_type: "im.message.receive_v1" }, event: { message, sender } };
}

const BOT_OPEN_ID = "ou_bot_xxx";

describe("filterMentions", () => {
  it("P2P: always responds and does not strip non-existent placeholders", () => {
    const r = filterMentions(
      envelope({ chatType: "p2p", text: "hello world" }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(true);
    expect(r.cleanedText).toBe("hello world");
    expect(r.reason).toBe("p2p");
  });

  it("P2P: empty text after parsing still returns shouldRespond=false (empty_text)", () => {
    const r = filterMentions(
      envelope({ chatType: "p2p", text: "" }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(false);
    expect(r.reason).toBe("empty_text");
  });

  it("Group + bot @-mentioned: respond and strip the placeholder", () => {
    const r = filterMentions(
      envelope({
        chatType: "group",
        text: "@_user_1 帮我查下天气",
        mentions: [{ key: "@_user_1", open_id: BOT_OPEN_ID, name: "bot" }],
      }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(true);
    expect(r.cleanedText).toBe("帮我查下天气");
    expect(r.reason).toBe("bot_mentioned");
  });

  it("Group + @_all: respond (treats as broadcast)", () => {
    const r = filterMentions(
      envelope({
        chatType: "group",
        text: "@_all 谁在线",
        mentions: [{ key: "@_all", name: "all" }],
      }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(true);
    expect(r.cleanedText).toBe("谁在线");
    expect(r.reason).toBe("at_all");
  });

  it("Group + no mention: silently skip", () => {
    const r = filterMentions(
      envelope({ chatType: "group", text: "some other discussion" }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(false);
    expect(r.reason).toBe("skipped_group_no_mention");
  });

  it("Group + other user @-mentioned (not bot): skip", () => {
    const r = filterMentions(
      envelope({
        chatType: "group",
        text: "@_user_1 hi",
        mentions: [{ key: "@_user_1", open_id: "ou_someone_else" }],
      }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(false);
    expect(r.reason).toBe("skipped_group_no_mention");
  });

  it("Group + mentionRequiredInGroup=false: respond to all, no strip", () => {
    const r = filterMentions(
      envelope({ chatType: "group", text: "free for all" }),
      { mentionRequiredInGroup: false, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(true);
    expect(r.cleanedText).toBe("free for all");
    expect(r.reason).toBe("all_in_group");
  });

  it("Strips multiple mentions including bot and others", () => {
    const r = filterMentions(
      envelope({
        chatType: "group",
        text: "@_user_1 @_user_2 帮我俩看下",
        mentions: [
          { key: "@_user_1", open_id: BOT_OPEN_ID },
          { key: "@_user_2", open_id: "ou_other" },
        ],
      }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(true);
    expect(r.cleanedText).toBe("帮我俩看下");
  });

  it("Non-text message_type: skip (empty_text)", () => {
    const r = filterMentions(
      envelope({ chatType: "p2p", text: "", messageType: "image" }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(false);
    expect(r.reason).toBe("empty_text");
  });

  it("Group + bot @-mentioned but text is only the mention: skip (empty after clean)", () => {
    const r = filterMentions(
      envelope({
        chatType: "group",
        text: "@_user_1 ",
        mentions: [{ key: "@_user_1", open_id: BOT_OPEN_ID }],
      }),
      { mentionRequiredInGroup: true, botOpenId: BOT_OPEN_ID },
    );
    expect(r.shouldRespond).toBe(false);
    expect(r.reason).toBe("empty_text");
    expect(r.cleanedText).toBe("");
  });
});
