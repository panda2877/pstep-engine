/**
 * Agent 引擎核心 - 占位实现
 * 待 Phase 2 实现完整的 Plan/Solve/Verify 循环
 */

import { Agent, Message } from '@earendil-works/pi-agent-core';
import type { PstepMessage, Phase, PhaseState } from '../types/messages.js';
import type { ProjectRule } from '../types/rules.js';

/**
 * PstepEngineOptions
 */
export interface PstepEngineOptions {
  gatewayUrl: string;
  model?: string;
  systemPrompt?: string;
}

/**
 * PstepEngine - Agent 逻辑引擎
 */
export class PstepEngine {
  private options: PstepEngineOptions;
  private agent: Agent | null = null;
  private phaseState: PhaseState = {
    current: 'plan',
    stepIndex: 0,
    totalSteps: 0,
  };

  constructor(options: PstepEngineOptions) {
    this.options = options;
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    // TODO: Phase 2 - 创建 Agent 实例
    // this.agent = new Agent({
    //   streamFn: this.createStreamFn(),
    //   systemPrompt: this.buildSystemPrompt(),
    // });
    console.log('[PstepEngine] Engine initialized');
  }

  /**
   * 构建系统提示词（包含项目规则）
   */
  private buildSystemPrompt(rules: ProjectRule[] = []): string {
    const staticRules = rules.filter(r => 
      ['code_style', 'constraints', 'domain_knowledge', 'best_practices'].includes(r.category)
    );
    
    const ruleText = staticRules.map(r => `- [${r.category}] ${r.content}`).join('\n');
    
    return `
You are Pstep, a multi-step reasoning agent.

## Workflow

You must follow the Plan → Solve → Verify cycle:

1. **Plan**: Analyze the task and break it down into actionable steps
2. **Solve**: Execute each step, using tools as needed
3. **Verify**: Check if the step was successful

## Rules

${ruleText || 'No specific rules configured.'}

## Output Format

- Use PlanMessage for planning phase
- Use SolveMessage for execution phase  
- Use VerifyMessage for verification phase
`;
  }

  /**
   * 创建流式函数（调用 gateway）
   */
  private createStreamFn() {
    // TODO: Phase 2 - 实现 SSE 流式调用 gateway
    return async (messages: Message[]) => {
      // Placeholder implementation
      const response = await fetch(`${this.options.gatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model || 'sensenova',
          messages,
          stream: true,
        }),
      });

      return response.body;
    };
  }

  /**
   * 执行 Plan/Solve/Verify 循环
   */
  async *execute(userMessage: string, sessionId: string): AsyncIterable<PstepMessage> {
    // TODO: Phase 2 - 实现完整的循环逻辑
    // 当前返回占位实现
    
    yield {
      type: 'plan',
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `框架已就绪，正在分析任务：${userMessage}`,
      steps: [],
      totalSteps: 0,
      createdAt: Date.now(),
    } as PstepMessage;

    yield {
      type: 'done',
      id: crypto.randomUUID(),
      role: 'assistant',
      sessionId,
      messageCount: 1,
      totalSteps: 0,
      completedSteps: 0,
      summary: 'Phase 1 框架搭建完成，等待 Phase 2 核心循环实现',
      createdAt: Date.now(),
    } as PstepMessage;
  }

  /**
   * 获取当前阶段状态
   */
  getPhaseState(): PhaseState {
    return this.phaseState;
  }

  /**
   * 切换阶段
   */
  async transitionTo(phase: Phase): Promise<void> {
    this.phaseState.current = phase;
    console.log(`[PstepEngine] Transitioned to phase: ${phase}`);
  }
}

/**
 * 创建 PstepEngine 实例
 */
export function createEngine(options: PstepEngineOptions): PstepEngine {
  return new PstepEngine(options);
}
