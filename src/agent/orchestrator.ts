/**
 * Agent 编排器
 * 接收 web 请求 -> 构建 Agent -> 流式返回
 */

import { Agent, type AgentOptions, type AgentEvent } from '@earendil-works/pi-agent-core';
import type { PstepMessage } from '../types/messages.js';
import { createPlanSolveLoop, type PlanSolveLoopOptions } from './plan-solve-loop.js';

/**
 * 编排器配置
 */
export interface OrchestratorOptions {
  gatewayUrl: string;
  model?: string;
  systemPrompt?: string;
  planSolveOptions?: PlanSolveLoopOptions;
}

/**
 * Agent 编排器
 */
export class Orchestrator {
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions) {
    this.options = {
      gatewayUrl: options.gatewayUrl,
      model: options.model ?? 'sensenova',
      systemPrompt: options.systemPrompt,
      planSolveOptions: options.planSolveOptions ?? {},
    };
  }

  /**
   * 处理聊天请求
   * 返回 PstepMessage 的异步迭代器（SSE 流）
   */
  async *execute(
    userMessage: string,
    projectId: string,
    sessionId: string
  ): AsyncIterable<PstepMessage> {
    const systemPrompt = this.buildSystemPrompt(projectId);
    const loop = createPlanSolveLoop(projectId, this.options.planSolveOptions);

    const agentOptions: AgentOptions = {
      initialState: {
        systemPrompt,
        messages: [],
      },
      sessionId,
    };

    const agent = new Agent(agentOptions);

    const unsubscribe = agent.subscribe(async (event: AgentEvent) => {
      if (event.type === 'turn_end') {
        const steeringMsg = await loop.handleAgentEvent(agent, event);
        if (steeringMsg) {
          agent.steer(steeringMsg);
        }
      }
    });

    try {
      await agent.prompt(userMessage);
      await agent.waitForIdle();

      const state = loop.getPhaseState();
      if (state.current === 'completed') {
        yield {
          id: crypto.randomUUID(),
          role: 'assistant',
          createdAt: Date.now(),
          type: 'done',
          sessionId,
          messageCount: agent.state.messages.length,
          totalSteps: state.totalSteps,
          completedSteps: state.stepIndex,
          summary: '任务完成',
        };
      }
    } finally {
      unsubscribe();
    }
  }

  private buildSystemPrompt(projectId: string): string {
    const basePrompt = this.options.systemPrompt ?? `
你是一位专业的 AI 编程助手，采用 Plan/Solve/Verify 范式工作：

1. **Plan（规划）**：分析任务，拆解为结构化步骤
2. **Solve（执行）**：逐步执行每个步骤，调用必要工具
3. **Verify（验证）**：验证每一步的结果，确保质量

请按此流程回答用户问题。
`;

    return basePrompt;
  }
}

/**
 * 创建编排器实例
 */
export function createOrchestrator(options: OrchestratorOptions): Orchestrator {
  return new Orchestrator(options);
}
