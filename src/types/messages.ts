/**
 * Pstep 消息类型定义
 * 基于 pi-agent-core 的声明合并扩展
 */

import { Message as PiMessage } from '@earendil-works/pi-agent-core';
import { Static, Type } from '@sinclair/typebox';

// ============================================================================
// 基础消息类型
// ============================================================================

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface BaseMessage {
  id: string;
  role: Role;
  createdAt: number;
}

// ============================================================================
// PlanMessage - 规划阶段消息
// ============================================================================

export const PlanStepSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  description: Type.String(),
  status: Type.Enum({
    pending: 'pending',
    in_progress: 'in_progress',
    completed: 'completed',
    failed: 'failed',
  }),
  dependencies: Type.Array(Type.String(), { default: [] }),
  createdAt: Type.Number(),
  completedAt: Type.Optional(Type.Number()),
});

export type PlanStep = Static<typeof PlanStepSchema>;

export const PlanMessageSchema = Type.Object({
  type: Type.Literal('plan'),
  content: Type.String(),
  steps: Type.Array(PlanStepSchema),
  totalSteps: Type.Number(),
});

export interface PlanMessage extends BaseMessage {
  type: 'plan';
  content: string;
  steps: PlanStep[];
  totalSteps: number;
}

// ============================================================================
// SolveMessage - 执行阶段消息
// ============================================================================

export const SolveMessageSchema = Type.Object({
  type: Type.Literal('solve'),
  content: Type.String(),
  stepId: Type.String(),
  stepNumber: Type.Number(),
  toolCalls: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    args: Type.Record(Type.String(), Type.Any()),
  }), { default: [] }),
  result: Type.Optional(Type.String()),
  isError: Type.Boolean({ default: false }),
});

export interface SolveMessage extends BaseMessage {
  type: 'solve';
  content: string;
  stepId: string;
  stepNumber: number;
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
  result?: string;
  isError?: boolean;
}

// ============================================================================
// VerifyMessage - 验证阶段消息
// ============================================================================

export const VerifyResultSchema = Type.Enum({
  pass: 'pass',
  fail: 'fail',
  needs_revision: 'needs_revision',
});

export const VerifyMessageSchema = Type.Object({
  type: Type.Literal('verify'),
  stepId: Type.String(),
  stepNumber: Type.Number(),
  status: VerifyResultSchema,
  feedback: Type.String(),
  suggestions: Type.Array(Type.String(), { default: [] }),
});

export interface VerifyMessage extends BaseMessage {
  type: 'verify';
  stepId: string;
  stepNumber: number;
  status: 'pass' | 'fail' | 'needs_revision';
  feedback: string;
  suggestions: string[];
}

// ============================================================================
// ToolCallMessage - 工具调用消息
// ============================================================================

export const ToolCallMessageSchema = Type.Object({
  type: Type.Literal('tool_call'),
  toolCallId: Type.String(),
  toolName: Type.String(),
  args: Type.Record(Type.String(), Type.Any()),
  timestamp: Type.Number(),
});

export interface ToolCallMessage extends BaseMessage {
  type: 'tool_call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  timestamp: number;
}

// ============================================================================
// ToolResultMessage - 工具结果消息
// ============================================================================

export const ToolResultMessageSchema = Type.Object({
  type: Type.Literal('tool_result'),
  toolCallId: Type.String(),
  result: Type.String(),
  isError: Type.Boolean(),
  timestamp: Type.Number(),
});

export interface ToolResultMessage extends BaseMessage {
  type: 'tool_result';
  toolCallId: string;
  result: string;
  isError: boolean;
  timestamp: number;
}

// ============================================================================
// DoneMessage - 会话结束消息
// ============================================================================

export const DoneMessageSchema = Type.Object({
  type: Type.Literal('done'),
  sessionId: Type.String(),
  messageCount: Type.Number(),
  totalSteps: Type.Number(),
  completedSteps: Type.Number(),
  summary: Type.String(),
});

export interface DoneMessage extends BaseMessage {
  type: 'done';
  sessionId: string;
  messageCount: number;
  totalSteps: number;
  completedSteps: number;
  summary: string;
}

// ============================================================================
// 联合类型
// ============================================================================

export type PstepMessage =
  | PlanMessage
  | SolveMessage
  | VerifyMessage
  | ToolCallMessage
  | ToolResultMessage
  | DoneMessage;

export type PstepMessageType = PstepMessage['type'];

// ============================================================================
// SSE 事件包装
// ============================================================================

export interface SseEvent<T = PstepMessage> {
  event: 'message' | 'done' | 'error';
  data: T;
  id?: string;
}

export function createSseEvent<T extends PstepMessage>(
  type: 'message' | 'done' | 'error',
  data: T,
  id?: string
): SseEvent<T> {
  return { event: type, data, id };
}

// ============================================================================
// 阶段状态
// ============================================================================

export type Phase = 'plan' | 'solve' | 'verify' | 'completed';

export interface PhaseState {
  current: Phase;
  stepIndex: number;
  totalSteps: number;
  plan?: PlanMessage;
  currentStep?: PlanStep;
  verifyResult?: VerifyMessage;
}
