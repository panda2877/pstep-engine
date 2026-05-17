/**
 * StreamingMessage - LLM token 实时流式消息
 * 用于 SSE 流中透传 LLM 的 token 输出
 */

import { BaseMessage } from "./messages.js";

export interface StreamingMessage extends BaseMessage {
  type: "streaming";
  content: string;
  isToolCall?: boolean;
  toolName?: string;
  toolCallId?: string;
  stepId?: string;
  stepNumber?: number;
}
