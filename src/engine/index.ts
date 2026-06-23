/**
 * Agent 引擎核心
 * Phase 2: 完整的 Plan/Solve/Verify 循环
 */

import type { PstepMessage, Phase, PhaseState } from '../types/messages.js';
import { createOrchestrator } from '../agent/orchestrator.js';
import type { HistoryEntry } from '../agent/orchestrator.js';
import type { PlanSolveLoopOptions } from '../agent/plan-solve-loop.js';
import { RuleEngine, type RuleEngineOptions } from '../rules/rule-engine.js';

/**
 * PstepEngineOptions
 */
export interface PstepEngineOptions {
  gatewayUrl: string;
  model?: string;
  systemPrompt?: string;
  planSolveOptions?: PlanSolveLoopOptions;
  ruleEngineOptions?: RuleEngineOptions;
  /** 加载指定会话的历史消息 */
  loadHistory?: (sessionId: string) => Promise<HistoryEntry[]>;
  /** 保存本次执行产生的新消息 */
  saveMessages?: (sessionId: string, entries: HistoryEntry[]) => Promise<void>;
}

/**
 * PstepEngine - Agent 逻辑引擎
 */
export class PstepEngine {
  private options: PstepEngineOptions;
  private orchestrator: ReturnType<typeof createOrchestrator> | null = null;
  private ruleEngine: RuleEngine;
  private phaseState: PhaseState = {
    current: 'plan',
    stepIndex: 0,
    totalSteps: 0,
  };

  constructor(options: PstepEngineOptions) {
    this.options = options;
    this.ruleEngine = new RuleEngine(options.ruleEngineOptions ?? {});
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
      loadHistory: this.options.loadHistory,
      saveMessages: this.options.saveMessages,
    });
    console.log('[PstepEngine] Engine initialized with Phase 2 core loop');
  }

  /**
   * 构建系统提示词（包含项目规则）
   */
  private async buildSystemPrompt(projectId: string): Promise<string> {
    const basePrompt = this.options.systemPrompt ?? `
你是一位专业的 AI 编程助手，采用 Plan/Solve/Verify 范式工作：

1. **Plan（规划）**：分析任务，拆解为结构化步骤
2. **Solve（执行）**：逐步执行每个步骤，调用必要工具
3. **Verify（验证）**：验证每一步的结果，确保质量

请按此流程回答用户问题。
`;

    // 通过规则引擎合并项目规则
    return this.ruleEngine.mergeWithBasePrompt(basePrompt, projectId);
  }

  /**
   * 执行 Plan/Solve/Verify 循环
   */
  async *execute(userMessage: string, projectId: string, sessionId: string): AsyncIterable<PstepMessage> {
    if (!this.orchestrator) {
      await this.initialize();
    }

    const systemPrompt = await this.buildSystemPrompt(projectId);
    
    // 临时覆盖 orchestrator 的 systemPrompt
    const originalBuild = (this.orchestrator as any).buildSystemPrompt;
    (this.orchestrator as any).buildSystemPrompt = () => systemPrompt;

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

  /**
   * 获取规则引擎实例（用于外部规则管理）
   */
  getRuleEngine(): RuleEngine {
    return this.ruleEngine;
  }
}

/**
 * 创建 PstepEngine 实例
 */
export function createEngine(options: PstepEngineOptions): PstepEngine {
  return new PstepEngine(options);
}
