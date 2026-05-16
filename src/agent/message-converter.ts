/**
 * 消息转换器
 * 将 Pstep 自定义消息转换为 LLM 可理解的格式
 */

import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { Message, UserMessage, AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai';

/**
 * 将 AgentMessage 转换为 LLM Message
 */
export function convertToLlm(messages: AgentMessage[]): Message[] {
  return messages
    .filter((msg): msg is UserMessage | AssistantMessage | ToolResultMessage => {
      return msg.role === 'user' || msg.role === 'assistant' || msg.role === 'toolResult';
    })
    .map((msg): Message => {
      if (msg.role === 'user') {
        return { role: 'user', content: msg.content, timestamp: msg.timestamp };
      }
      if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: msg.content,
          api: msg.api,
          provider: msg.provider,
          model: msg.model,
          usage: msg.usage,
          stopReason: msg.stopReason,
          timestamp: msg.timestamp,
        };
      }
      return {
        role: 'toolResult',
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        content: msg.content,
        isError: msg.isError,
        timestamp: msg.timestamp,
      };
    });
}

/**
 * 将 LLM Message 转换回 AgentMessage
 */
export function convertFromLlm(message: UserMessage | ToolResultMessage): AgentMessage {
  if (message.role === 'toolResult') {
    return {
      role: 'toolResult',
      content: message.content,
      toolCallId: message.toolCallId,
      toolName: message.toolName,
      isError: message.isError,
      timestamp: Date.now(),
    };
  }
  return {
    role: 'user',
    content: message.content,
    timestamp: message.timestamp,
  };
}
