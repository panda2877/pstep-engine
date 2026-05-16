/**
 * pstep-engine 类型导出
 * 注意：实际类型来自 @earendil-works/pi-agent-core
 * 这里使用声明合并进行扩展
 */

// 声明合并：扩展 pi-agent-core 的消息类型
declare module '@earendil-works/pi-agent-core' {
  interface Message {
    type?: 'plan' | 'solve' | 'verify' | 'tool_call' | 'tool_result' | 'done';
    steps?: import('../types/messages.js').PlanStep[];
    stepId?: string;
    stepNumber?: number;
    status?: 'pass' | 'fail' | 'needs_revision';
    feedback?: string;
    suggestions?: string[];
    toolCallId?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    isError?: boolean;
    totalSteps?: number;
    completedSteps?: number;
    summary?: string;
  }
}

export * from './types/index.js';
export * from './db/index.js';
export * from './server/index.js';
