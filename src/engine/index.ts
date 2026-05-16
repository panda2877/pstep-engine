/**
 * Agent 引擎核心
 * Phase 2: 完整的 Plan/Solve/Verify 循环
 */

import { Agent, type AgentOptions, type AgentEvent } from '@earendil-works/pi-agent-core';
import type { PstepMessage, Phase, PhaseState } from '../types/messages.js';
import type { ProjectRule } from '../types/rules.js';
import { createOrchestrator, type OrchestratorOptions } from '../agent/orchestrator.js';
import { createPlanSolveLoop, type PlanSolveLoopOptions } from '../agent/plan-solve-loop.js';
import { convertToLlm } from '../agent/message-converter.js';

/**
 * PstepEngineOptions
 */
export interface PstepEngineOptions {
  gatewayUrl: string;
  model?: string;
  systemPrompt?: string;
  planSolveOptions?: PlanSolveLoopOptions;
}

/**
 * PstepEngine - Agent 逻辑引擎
 */
export class PstepEngine {
  private options: PstepEngineOptions;
  private orchestrator: ReturnType<typeof createOrchestrator> | null = null;
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
    this.orchestrator = createOrchestrator({
      gatewayUrl: this.options.gatewayUrl,
      model: this.options.model,
      systemPrompt: this.options.systemPrompt,
      planSolveOptions: this.options.planSolveOptions,
    });
    console.log('[PstepEngine] Engine initialized with Phase 2 core loop');
  }

  /**
   * 构建系统提示词（包含项目规则）
   */
  private buildSystemPrompt(rules: ProjectRule[] = []): string {
    const staticRules = rules.filter(r => 
      ['code_style', 'constraints', 'domain_knowledge', 'best_practices'].includes(r.category)
    );
    
    const ruleText = staticRules.map(r => '- [' + r.category + '] ' + r.content).join('\n');
    
    return [
      'You are Pstep, a multi-step reasoning agent.',
      '',
      '## Workflow',
      '',
      'You must follow the Plan -> Solve -> Verify cycle:',
      '',
      '1. **Plan**: Analyze the task and break it down into actionable steps',
      '2. **Solve**: Execute each step, using tools as needed',
      '3. **Verify**: Check if the step was successful',
      '',
      '## Rules',
      '',
      ruleText || 'No specific rules configured.',
      '',
      '## Output Format',
      '',
      '- Use numbered steps (1. Title: Description) for planning phase',
      '- Use clear completion markers for execution phase',
      '- Use pass/fail/needs_revision for verification phase',
    ].join('\n');
  }

  /**
   * 执行 Plan/Solve/Verify 循环
   */
  async *execute(userMessage: string, sessionId: string): AsyncIterable<PstepMessage> {
    if (!this.orchestrator) {
      await this.initialize();
    }

    const projectId = 'default';
    yield* this.orchestrator!.execute(userMessage, projectId, sessionId);
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
    console.log('[PstepEngine] Transitioned to phase: ' + phase);
  }
}

/**
 * 创建 PstepEngine 实例
 */
export function createEngine(options: PstepEngineOptions): PstepEngine {
  return new PstepEngine(options);
}
