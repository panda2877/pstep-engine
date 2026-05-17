/**
 * Solve 执行工具
 * 负责执行 Agent 执行阶段的工具调用
 */

import type { AgentMessage } from '@earendil-works/pi-agent-core';

export interface SolveEvent {
  type: 'tool_call' | 'tool_result' | 'text';
  stepId: string;
  content: string;
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
}

export interface SolveExecutorResult {
  events: SolveEvent[];
  finalContent: string;
  toolCallCount: number;
  hasError: boolean;
}

/**
 * SolveExecutor - 监控和提取执行阶段的事件
 */
export class SolveExecutor {
  /**
   * 从消息列表中提取执行阶段的事件
   */
  extractEvents(
    messages: AgentMessage[],
    stepId: string,
  ): SolveExecutorResult {
    const events: SolveEvent[] = [];
    let toolCallCount = 0;
    let hasError = false;
    let finalContent = '';

    for (const msg of messages) {
      if (msg.role === 'assistant' && 'toolCalls' in msg) {
        const tc = msg as { toolCalls?: Array<{ id: string; name: string }> };
        if (tc.toolCalls) {
          for (const tcItem of tc.toolCalls) {
            events.push({
              type: 'tool_call',
              stepId,
              content: tcItem.name,
              timestamp: Date.now(),
              toolCallId: tcItem.id,
              toolName: tcItem.name,
            });
            toolCallCount++;
          }
        }
      }

      if (msg.role === 'toolResult') {
        const tr = msg as { toolCallId?: string; toolName?: string; isError?: boolean; content: unknown };
        events.push({
          type: 'tool_result',
          stepId,
          content: typeof tr.content === 'string' ? tr.content.slice(0, 500) : JSON.stringify(tr.content).slice(0, 500),
          timestamp: Date.now(),
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          isError: tr.isError,
        });
        if (tr.isError) hasError = true;
      }

      if (msg.role === 'assistant' && 'content' in msg) {
        const content = typeof msg.content === 'string' ? msg.content : '';
        if (content) finalContent = content;
      }
    }

    return { events, finalContent, toolCallCount, hasError };
  }
}
