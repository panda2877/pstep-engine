/**
 * Plan/Solve/Verify 循环控制器
 * 设计文档第 6 章：Plan → Solve → Verify 完整循环
 *
 * 增强功能：
 * - 集成 SubAgentManager 支持并行步骤执行
 * - DAG 依赖感知的步骤调度
 * - 完整的阶段转换控制
 */

import type { Agent, AgentMessage, AgentEvent } from '@earendil-works/pi-agent-core';
import type { UserMessage } from '@earendil-works/pi-ai';
import type { PlanStep, Phase, PhaseState, PlanMessage, VerifyMessage } from '../types/messages.js';
import type { ProjectRule } from '../types/rules.js';
import { SubAgentManager, type SubAgentManagerOptions, type StepResult } from './sub-agent.js';

// ============================================================================
// 配置与类型
// ============================================================================

export interface PlanSolveLoopOptions {
  maxIterations?: number;
  autoVerify?: boolean;
  gatewayUrl?: string;
  subAgentOptions?: SubAgentManagerOptions;
}

type VerifyStatus = 'pass' | 'fail' | 'needs_revision';

export interface SolveCallback {
  onStepStart?: (step: PlanStep) => void;
  onStepComplete?: (step: PlanStep, result: StepResult) => void;
}

// ============================================================================
// PlanSolveLoop
// ============================================================================

export class PlanSolveLoop {
  private phase: Phase = 'plan';
  private steps: PlanStep[] = [];
  private currentStepIndex = 0;
  private stepResults: Map<string, string> = new Map();
  private verifyResults: Map<string, VerifyStatus> = new Map();
  private iterationCount = 0;
  private options: PlanSolveLoopOptions;
  private subAgentManager: SubAgentManager | null = null;
  private projectRules: ProjectRule[] = [];

  constructor(
    private projectId: string,
    options: PlanSolveLoopOptions = {},
  ) {
    this.options = {
      maxIterations: options.maxIterations ?? 10,
      autoVerify: options.autoVerify ?? true,
      gatewayUrl: options.gatewayUrl ?? process.env.GATEWAY_URL ?? 'http://localhost:3001',
      subAgentOptions: options.subAgentOptions ?? {
        gatewayUrl: options.gatewayUrl ?? process.env.GATEWAY_URL ?? 'http://localhost:3001',
      },
    };
  }

  /** 设置项目规则（传递给子代理） */
  setProjectRules(rules: ProjectRule[]): void {
    this.projectRules = rules;
  }

  /** 获取当前阶段状态 */
  getPhaseState(): PhaseState {
    return {
      current: this.phase,
      stepIndex: this.currentStepIndex,
      totalSteps: this.steps.length,
      plan: this.steps.length > 0 ? this.createPlanFromSteps() : undefined,
      currentStep: this.steps[this.currentStepIndex],
      verifyResult: this.getVerifyResultForCurrentStep(),
    };
  }

  /** 重置循环状态 */
  reset(): void {
    this.phase = 'plan';
    this.steps = [];
    this.currentStepIndex = 0;
    this.stepResults.clear();
    this.verifyResults.clear();
    this.iterationCount = 0;
    this.subAgentManager = null;
  }

  /** 获取当前步骤 */
  getCurrentStep(): PlanStep | undefined {
    return this.steps[this.currentStepIndex];
  }

  /** 获取所有步骤 */
  getSteps(): PlanStep[] {
    return this.steps;
  }

  /** 获取当前阶段 */
  getPhase(): Phase {
    return this.phase;
  }

  // ============================================================================
  // Agent 事件处理（主循环入口）
  // ============================================================================

  async handleAgentEvent(
    agent: Agent,
    event: AgentEvent,
  ): Promise<UserMessage | null> {
    this.iterationCount++;

    if (this.iterationCount > this.options.maxIterations!) {
      throw new Error('Maximum iterations exceeded');
    }

    if (event.type === 'turn_end') {
      switch (this.phase) {
        case 'plan':
          return this.handlePlanComplete(agent);
        case 'solve':
          return this.handleSolveComplete(agent);
        case 'verify':
          return this.handleVerifyComplete(agent);
      }
    }

    return null;
  }

  // ============================================================================
  // Plan 阶段
  // ============================================================================

  private handlePlanComplete(agent: Agent): UserMessage | null {
    const messages = agent.state.messages;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === 'assistant' && this.containsPlanContent(this.getMessageContent(lastMsg))) {
      const steps = this.extractSteps(this.getMessageContent(lastMsg));
      if (steps.length > 0) {
        this.steps = steps;
        this.currentStepIndex = 0;
        this.phase = 'solve';

        return {
          role: 'user',
          content: `已收到 ${steps.length} 个步骤的规划。现在开始执行第 1 步：${steps[0].title}。完成后需要进行验证。`,
          timestamp: Date.now(),
        };
      }
    }

    return null;
  }

  // ============================================================================
  // Solve 阶段
  // ============================================================================

  private handleSolveComplete(agent: Agent): UserMessage | null {
    const currentStep = this.steps[this.currentStepIndex];
    if (!currentStep) {
      this.phase = 'completed';
      return {
        role: 'user',
        content: '所有步骤已执行完成。请生成最终总结。',
        timestamp: Date.now(),
      };
    }

    const messages = agent.state.messages;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === 'assistant') {
      this.stepResults.set(currentStep.id, this.getMessageContent(lastMsg));

      if (this.options.autoVerify!) {
        this.phase = 'verify';
        return {
          role: 'user',
          content: `第 ${this.currentStepIndex + 1} 步执行完成。请验证结果：${currentStep.description}。`,
          timestamp: Date.now(),
        };
      } else {
        return this.moveToNextStep();
      }
    }

    return null;
  }

  // ============================================================================
  // Verify 阶段
  // ============================================================================

  private handleVerifyComplete(agent: Agent): UserMessage | null {
    const currentStep = this.steps[this.currentStepIndex];
    if (!currentStep) {
      this.phase = 'completed';
      return null;
    }

    const messages = agent.state.messages;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === 'assistant') {
      const verifyResult = this.parseVerifyResult(this.getMessageContent(lastMsg));
      this.verifyResults.set(currentStep.id, verifyResult.status);

      switch (verifyResult.status) {
        case 'pass':
          return this.moveToNextStep();

        case 'needs_revision':
          this.phase = 'solve';
          return {
            role: 'user',
            content: `验证未通过：${verifyResult.feedback}\n\n改进建议：${verifyResult.suggestions.join('\n')}\n\n请修复第 ${this.currentStepIndex + 1} 步的问题后重新执行。`,
            timestamp: Date.now(),
          };

        case 'fail': {
          return {
            role: 'user',
            content: `验证失败：${verifyResult.feedback}\n\n请重新评估当前步骤的可行性，或返回规划阶段重新拆解任务。`,
            timestamp: Date.now(),
          };
        }
      }
    }

    return null;
  }

  // ============================================================================
  // 子代理并行执行（增强功能）
  // ============================================================================

  /**
   * 使用子代理并行执行一批步骤
   * 适用于 Solve 阶段中多个无依赖步骤可同时执行的场景
   */
  async executeWithSubAgents(
    steps: PlanStep[],
    callbacks?: SolveCallback,
  ): Promise<StepResult[]> {
    if (!this.subAgentManager) {
      this.subAgentManager = new SubAgentManager({
        gatewayUrl: this.options.gatewayUrl!,
        model: this.options.subAgentOptions?.model,
        maxConcurrency: this.options.subAgentOptions?.maxConcurrency,
      });
    }

    return this.subAgentManager.executeSteps(
      steps,
      this.projectRules,
      callbacks?.onStepStart,
      callbacks?.onStepComplete,
    );
  }

  // ============================================================================
  // 步骤导航
  // ============================================================================

  private moveToNextStep(): UserMessage {
    this.currentStepIndex++;

    if (this.currentStepIndex >= this.steps.length) {
      this.phase = 'completed';
      return {
        role: 'user',
        content: '所有步骤已验证通过。请生成最终总结。',
        timestamp: Date.now(),
      };
    }

    const nextStep = this.steps[this.currentStepIndex];
    this.phase = 'solve';

    return {
      role: 'user',
      content: `第 ${this.currentStepIndex} 步验证通过。现在开始执行第 ${this.currentStepIndex + 1} 步：${nextStep.title}。`,
      timestamp: Date.now(),
    };
  }

  // ============================================================================
  // Plan 内容解析
  // ============================================================================

  private containsPlanContent(content: string): boolean {
    return /步骤|step|plan|拆解|分解|\d+\.\s/.test(content);
  }

  private extractSteps(content: string): PlanStep[] {
    const lines = content.split('\n');
    const steps: PlanStep[] = [];
    let current: Partial<PlanStep> | null = null;

    for (const line of lines) {
      // 匹配 "1. 标题: 描述" 格式
      const match = line.match(/^(\d+)\.\s*(.+?):\s*(.+)$/);
      if (match) {
        if (current) {
          steps.push(this.finalizeStep(current));
        }
        current = {
          id: `step-${steps.length + 1}`,
          title: match[2].trim(),
          description: match[3].trim(),
          status: 'pending' as const,
          dependencies: [],
          createdAt: Date.now(),
        };
        continue;
      }

      // 匹配 "1. 标题" 格式（无描述）
      const titleMatch = line.match(/^(\d+)\.\s*(.+)$/);
      if (titleMatch) {
        if (current) {
          steps.push(this.finalizeStep(current));
        }
        current = {
          id: `step-${steps.length + 1}`,
          title: titleMatch[2].trim(),
          description: titleMatch[2].trim(),
          status: 'pending' as const,
          dependencies: [],
          createdAt: Date.now(),
        };
        continue;
      }

      // 依赖标注: "  依赖: step-1, step-3"
      const depMatch = line.match(/^\s*依赖[：:]\s*(.+)$/);
      if (depMatch && current) {
        current.dependencies = depMatch[1]
          .split(/[,，]/)
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);
      }
    }

    if (current) {
      steps.push(this.finalizeStep(current));
    }

    // 如果没解析出步骤，尝试按行拆分
    if (steps.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
          steps.push({
            id: `step-${steps.length + 1}`,
            title: trimmed.slice(0, 50),
            description: trimmed,
            status: 'pending' as const,
            dependencies: [],
            createdAt: Date.now(),
          });
        }
      }
    }

    return steps;
  }

  private finalizeStep(step: Partial<PlanStep>): PlanStep {
    return {
      id: step.id ?? `step-${Date.now()}`,
      title: step.title ?? 'Untitled Step',
      description: step.description ?? '',
      status: 'pending' as const,
      dependencies: step.dependencies ?? [],
      createdAt: step.createdAt ?? Date.now(),
    };
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  private createPlanFromSteps(): PlanMessage {
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      createdAt: Date.now(),
      type: 'plan',
      content: '以下是任务拆解的步骤规划：',
      steps: this.steps,
      totalSteps: this.steps.length,
    };
  }

  private getVerifyResultForCurrentStep(): VerifyMessage | undefined {
    const currentStep = this.steps[this.currentStepIndex];
    if (!currentStep) return undefined;

    const status = this.verifyResults.get(currentStep.id) ?? 'pass';
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      createdAt: Date.now(),
      type: 'verify',
      stepId: currentStep.id,
      stepNumber: this.currentStepIndex + 1,
      status,
      feedback: '',
      suggestions: [],
    };
  }

  private parseVerifyResult(content: string): {
    status: 'pass' | 'fail' | 'needs_revision';
    feedback: string;
    suggestions: string[];
  } {
    let status: 'pass' | 'fail' | 'needs_revision' = 'pass';

    if (/验证通过|pass|success|通过|完成|✓|✅/i.test(content)) {
      status = 'pass';
    } else if (/验证失败|fail|错误|失败|✗|❌/i.test(content)) {
      status = 'fail';
    } else if (/需要修改|改进|建议|revision|调整|重新|不通过/i.test(content)) {
      status = 'needs_revision';
    }

    // 提取建议
    const suggestions: string[] = [];
    const suggestionLines = content.split('\n').filter(
      (l) => /建议|可以|应该|推荐|建议采用/.test(l),
    );
    suggestions.push(...suggestionLines.map((l) => l.trim()));

    return { status, feedback: content, suggestions };
  }

  private getMessageContent(msg: AgentMessage): string {
    if ('content' in msg) {
      if (typeof msg.content === 'string') {
        return msg.content;
      }
      return (msg.content as Array<{ type: string; text?: string }>)
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text' && !!c.text)
        .map((c) => c.text)
        .join('\n');
    }
    if ('command' in msg && 'output' in msg) {
      const m = msg as { command: string; output: string };
      return `$ ${m.command}\n${m.output}`;
    }
    if ('summary' in msg) {
      const m = msg as { summary: string };
      return m.summary;
    }
    return '';
  }
}

/**
 * 创建 Plan/Solve/Verify 循环控制器
 */
export function createPlanSolveLoop(
  projectId: string,
  options?: PlanSolveLoopOptions,
): PlanSolveLoop {
  return new PlanSolveLoop(projectId, options);
}
