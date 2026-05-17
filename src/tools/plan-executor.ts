/**
 * Plan 执行工具
 * 负责执行 Agent 规划阶段的工具调用
 */

import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { PlanStep } from '../types/messages.js';

export interface PlanExecutorResult {
  steps: PlanStep[];
  rawContent: string;
}

/**
 * PlanExecutor - 解析和组织规划结果
 */
export class PlanExecutor {
  /**
   * 从 Agent 消息中提取规划步骤
   */
  extractSteps(messages: AgentMessage[]): PlanExecutorResult {
    const lastAssistantMsg = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');

    if (!lastAssistantMsg) {
      return { steps: [], rawContent: '' };
    }

    const content = this.getContent(lastAssistantMsg);
    const steps = this.parseSteps(content);

    return { steps, rawContent: content };
  }

  /**
   * 从消息内容中解析步骤列表
   */
  private parseSteps(content: string): PlanStep[] {
    const lines = content.split('\n');
    const steps: PlanStep[] = [];

    for (const line of lines) {
      const match = line.match(/^(\d+)\.\s*(.+?):\s*(.+)$/);
      if (match) {
        steps.push({
          id: `step-${steps.length + 1}`,
          title: match[2].trim(),
          description: match[3].trim(),
          status: 'pending' as const,
          dependencies: [],
          createdAt: Date.now(),
        });
        continue;
      }

      const titleMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (titleMatch) {
        steps.push({
          id: `step-${steps.length + 1}`,
          title: titleMatch[2].trim(),
          description: titleMatch[2].trim(),
          status: 'pending' as const,
          dependencies: [],
          createdAt: Date.now(),
        });
      }
    }

    return steps;
  }

  /**
   * 获取消息内容的文本
   */
  private getContent(msg: AgentMessage): string {
    if ('content' in msg) {
      if (typeof msg.content === 'string') return msg.content;
      return (msg.content as Array<{ type: string; text?: string }>)
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && !!c.text)
        .map((c) => c.text)
        .join('\n');
    }
    return '';
  }
}
