/**
 * Verify 执行工具
 * 负责验证 Agent 执行结果
 */

import type { AgentMessage } from '@earendil-works/pi-agent-core';

export type VerifyDecision = 'pass' | 'fail' | 'needs_revision';

export interface VerifyResult {
  status: VerifyDecision;
  feedback: string;
  suggestions: string[];
  confidence: number;
}

/**
 * VerifyExecutor - 解析验证结果
 */
export class VerifyExecutor {
  /**
   * 从最后一条 Assistant 消息中解析验证结果
   */
  parseVerification(messages: AgentMessage[]): VerifyResult {
    const lastAssistantMsg = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant');

    if (!lastAssistantMsg) {
      return { status: 'pass', feedback: '', suggestions: [], confidence: 0.5 };
    }

    const content = this.getMessageContent(lastAssistantMsg);
    return this.parseResult(content);
  }

  /**
   * 从文本内容中解析验证结果
   */
  parseResult(content: string): VerifyResult {
    let status: VerifyDecision = 'pass';
    let confidence = 0.7;

    if (/验证通过|pass|success|通过|完成|✓|✅/i.test(content)) {
      status = 'pass';
      confidence = 0.9;
    } else if (/验证失败|fail|错误|失败|✗|❌/i.test(content)) {
      status = 'fail';
      confidence = 0.8;
    } else if (/需要修改|改进|建议|revision|调整|重新|不通过/i.test(content)) {
      status = 'needs_revision';
      confidence = 0.7;
    }

    const suggestions: string[] = [];
    for (const line of content.split('\n')) {
      if (/建议|可以|应该|推荐|建议采用|改进/.test(line)) {
        suggestions.push(line.trim());
      }
    }

    return { status, feedback: content, suggestions, confidence };
  }

  private getMessageContent(msg: AgentMessage): string {
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
