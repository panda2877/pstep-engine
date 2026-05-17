/**
 * Plan/Solve/Verify 循环控制器
 */

import type { Agent, AgentMessage, AgentEvent } from '@earendil-works/pi-agent-core';
import type { UserMessage } from '@earendil-works/pi-ai';
import type { PlanStep, Phase, PhaseState, PlanMessage, VerifyMessage } from '../types/messages.js';

/**
 * Plan/Solve/Verify 循环配置
 */
export interface PlanSolveLoopOptions {
  maxIterations?: number;
  autoVerify?: boolean;
}

type VerifyStatus = 'pass' | 'fail' | 'needs_revision';

/**
 * Plan/Solve/Verify 循环控制器
 */
export class PlanSolveLoop {
  private phase: Phase = 'plan';
  private steps: PlanStep[] = [];
  private currentStepIndex = 0;
  private stepResults: Map<string, string> = new Map();
  private verifyResults: Map<string, VerifyStatus> = new Map();
  private iterationCount = 0;
  private options: PlanSolveLoopOptions;

  constructor(
    private projectId: string,
    options: PlanSolveLoopOptions = {}
  ) {
    this.options = {
      maxIterations: options.maxIterations ?? 10,
      autoVerify: options.autoVerify ?? true,
    };
  }

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

  /**
   * 处理 Agent 事件，返回需要注入的 steering 消息
   */
  async handleAgentEvent(
    agent: Agent,
    event: AgentEvent
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

  private handlePlanComplete(agent: Agent): UserMessage | null {
    const messages = agent.state.messages;
    const lastMsg = messages[messages.length - 1];
    
    if (lastMsg.role === 'assistant' && this.containsPlanContent(this.getMessageContent(lastMsg))) {
      const steps = this.extractSteps(this.getMessageContent(lastMsg));
      if (steps.length > 0) {
        this.steps = steps;
        this.phase = 'solve';
        this.currentStepIndex = 0;
        
        return {
          role: 'user',
          content: '已收到 ' + steps.length + ' 个步骤的规划。现在开始执行第 1 步：' + steps[0].title + '。完成后需要进行验证。',
          timestamp: Date.now(),
        };
      }
    }
    
    return null;
  }

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
          content: '第 ' + (this.currentStepIndex + 1) + ' 步执行完成。请验证结果：' + currentStep.description + '。',
          timestamp: Date.now(),
        };
      } else {
        return this.moveToNextStep();
      }
    }

    return null;
  }

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
            content: '验证未通过：' + verifyResult.feedback + '\n\n改进建议：' + verifyResult.suggestions.join('\n') + '\n\n请修复第 ' + (this.currentStepIndex + 1) + ' 步的问题后重新执行。',
            timestamp: Date.now(),
          };
          
        case 'fail':
          return {
            role: 'user',
            content: '验证失败：' + verifyResult.feedback + '\n\n请重新评估当前步骤的可行性，或返回规划阶段重新拆解任务。',
            timestamp: Date.now(),
          };
      }
    }

    return null;
  }

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
      content: '第 ' + this.currentStepIndex + ' 步验证通过。现在开始执行第 ' + (this.currentStepIndex + 1) + ' 步：' + nextStep.title + '。',
      timestamp: Date.now(),
    };
  }

  private containsPlanContent(content: string): boolean {
    return /步骤|step|plan|拆解|分解|\d+\.\s/.test(content);
  }

  private extractSteps(content: string): PlanStep[] {
    const lines = content.split('\n');
    const steps: PlanStep[] = [];
    
    for (const line of lines) {
      const match = line.match(/^(\d+)\.\s*(.+?):\s*(.+)$/);
      if (match) {
        steps.push({
          id: 'step-' + (steps.length + 1),
          title: match[2].trim(),
          description: match[3].trim(),
          status: 'pending',
          dependencies: [],
          createdAt: Date.now(),
        });
      }
    }
    
    return steps;
  }

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
    
    if (/验证通过|pass|success|通过|完成/i.test(content)) {
      status = 'pass';
    } else if (/验证失败|fail|错误|失败/i.test(content)) {
      status = 'fail';
    } else if (/需要修改|改进|建议|revision|调整/i.test(content)) {
      status = 'needs_revision';
    }

    return {
      status,
      feedback: content,
      suggestions: [],
    };
  }

private getMessageContent(msg: AgentMessage): string {
    if ("content" in msg) {
      if (typeof msg.content === "string") {
        return msg.content;
      }
      return (msg.content as Array<{ type: string; text?: string }>)
        .filter((c): c is { type: "text"; text: string } => c.type === "text" && !!c.text)
        .map((c) => c.text)
        .join("\n");
    }
    if ("command" in msg && "output" in msg) {
      return "$ " + msg.command + "\n" + msg.output;
    }
    if ("summary" in msg) {
      return msg.summary;
    }
    return "";
  }
  public reset(): void {
    this.phase = 'plan';
    this.steps = [];
    this.currentStepIndex = 0;
    this.stepResults.clear();
    this.verifyResults.clear();
    this.iterationCount = 0;
  }

  public getCurrentStep(): PlanStep | undefined {
    return this.steps[this.currentStepIndex];
  }

  public getSteps(): PlanStep[] {
    return this.steps;
  }

  public getPhase(): Phase {
    return this.phase;
  }
}

/**
 * 创建 Plan/Solve/Verify 循环控制器
 */
export function createPlanSolveLoop(
  projectId: string,
  options?: PlanSolveLoopOptions
): PlanSolveLoop {
  return new PlanSolveLoop(projectId, options);
}
