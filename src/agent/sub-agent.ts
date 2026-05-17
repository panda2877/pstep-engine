/**
 * 子代理 / 多代理协作管理器
 * 设计文档第 7 章：子代理创建、DAG 调度、并行执行、结果汇总
 */

import { Agent, type AgentOptions, type AgentMessage } from "@earendil-works/pi-agent-core";
import type { PlanStep } from "../types/messages.js";
import type { ProjectRule } from "../types/rules.js";

// ============================================================================
// 类型定义
// ============================================================================

export interface StepResult {
  stepId: string;
  content: string;
  messages: unknown[];
  toolCalls: number;
  isError: boolean;
  errorMessage?: string;
}

export interface DAGLayer {
  layerIndex: number;
  steps: PlanStep[];
  dependencies: string[];
}

export interface DAG {
  layers: DAGLayer[];
  allSteps: Map<string, PlanStep>;
}

export interface SubAgentManagerOptions {
  gatewayUrl: string;
  model?: string;
  maxConcurrency?: number;
}

// ============================================================================
// SubAgentManager
// ============================================================================

export class SubAgentManager {
  private options: Required<SubAgentManagerOptions>;

  constructor(options: SubAgentManagerOptions) {
    this.options = {
      gatewayUrl: options.gatewayUrl,
      model: options.model ?? "sensenova",
      maxConcurrency: options.maxConcurrency ?? 3,
    };
  }

  /** 构建 DAG，确定执行层级 */
  buildDAG(steps: PlanStep[]): DAG {
    const stepMap = new Map<string, PlanStep>();
    const remaining = new Set<string>();
    const dependencyMap = new Map<string, Set<string>>();

    for (const step of steps) {
      stepMap.set(step.id, step);
      remaining.add(step.id);
      dependencyMap.set(step.id, new Set(step.dependencies ?? []));
    }

    const layers: DAGLayer[] = [];
    let layerIndex = 0;

    while (remaining.size > 0) {
      const currentLayer: PlanStep[] = [];

      for (const stepId of remaining) {
        const deps = dependencyMap.get(stepId)!;
        const unsatisfiedDeps = new Set(
          [...deps].filter((d) => remaining.has(d)),
        );
        if (unsatisfiedDeps.size === 0) {
          currentLayer.push(stepMap.get(stepId)!);
        }
      }

      if (currentLayer.length === 0) {
        const stuck = [...remaining]
          .map((id) => stepMap.get(id)?.title ?? id)
          .join(", ");
        throw new Error(`Circular dependency detected in steps: ${stuck}`);
      }

      layers.push({ layerIndex, steps: currentLayer, dependencies: [] });

      for (const step of currentLayer) {
        remaining.delete(step.id);
      }
      layerIndex++;
    }

    return { layers, allSteps: stepMap };
  }

  /** 按 DAG 层级并行执行所有步骤 */
  async executeSteps(
    steps: PlanStep[],
    projectRules: ProjectRule[],
    onStepStart?: (step: PlanStep) => void,
    onStepComplete?: (step: PlanStep, result: StepResult) => void,
  ): Promise<StepResult[]> {
    const dag = this.buildDAG(steps);
    const allResults: StepResult[] = [];
    const resultsMap = new Map<string, StepResult>();

    for (const layer of dag.layers) {
      const batches: PlanStep[][] = [];
      for (let i = 0; i < layer.steps.length; i += this.options.maxConcurrency) {
        batches.push(layer.steps.slice(i, i + this.options.maxConcurrency));
      }

      for (const batch of batches) {
        const batchResults = await Promise.all(
          batch.map(async (step) => {
            const dependencyResults: StepResult[] = [];
            for (const depId of step.dependencies ?? []) {
              const depResult = resultsMap.get(depId);
              if (depResult) dependencyResults.push(depResult);
            }

            onStepStart?.(step);
            const result = await this.executeSingleStep(step, projectRules, dependencyResults);
            resultsMap.set(step.id, result);
            onStepComplete?.(step, result);
            return result;
          }),
        );
        allResults.push(...batchResults);
      }
    }

    return allResults;
  }

  /** 提取消息文本内容 */
private extractContent(msg: AgentMessage): string {
    if ('content' in msg) {
      const ct = msg.content;
      if (typeof ct === 'string') return ct;
      if (Array.isArray(ct)) {
        const texts: string[] = [];
        for (const item of ct) {
          if (item.type === 'text' && 'text' in item) {
            texts.push((item as { text: string }).text as string);
          }
        }
        return texts.join('\n');
      }
    }
    return '';
  }

  /** 统计工具调用次数 */
  private countToolCalls(messages: AgentMessage[]): number {
    let count = 0;
    for (const m of messages) {
      if (m.role === 'assistant' && 'toolCalls' in m) {
        count++;
      }
    }
    return count;
  }

  /** 执行单个步骤（创建子 Agent） */
  private async executeSingleStep(
    step: PlanStep,
    rules: ProjectRule[],
    dependencyResults: StepResult[],
  ): Promise<StepResult> {
    const systemPrompt = this.buildStepPrompt(step, rules, dependencyResults);

    const agentOptions: AgentOptions = {
      initialState: {
        systemPrompt,
        messages: [],
        tools: [],
      },
    };

    const subAgent = new Agent(agentOptions);

    try {
      await subAgent.prompt(step.description);
      await subAgent.waitForIdle();

      const messages = subAgent.state.messages;
      const lastMsg = messages[messages.length - 1];
      const content = lastMsg ? this.extractContent(lastMsg) : '';

      return {
        stepId: step.id,
        content,
        messages: messages as unknown[],
        toolCalls: this.countToolCalls(messages),
        isError: false,
      };
    } catch (err) {
      return {
        stepId: step.id,
        content: "",
        messages: [],
        toolCalls: 0,
        isError: true,
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** 构建步骤专用 Prompt */
  private buildStepPrompt(
    step: PlanStep,
    rules: ProjectRule[],
    dependencyResults: StepResult[],
  ): string {
    const parts: string[] = [
      "你是一位专业 AI 助手，正在执行一个子任务。",
      "",
      "## 当前任务",
      "步骤 ID: " + step.id,
      "标题: " + step.title,
      "描述: " + step.description,
      "",
    ];

    if (dependencyResults.length > 0) {
      parts.push("## 前置依赖步骤的结果");
      for (const dep of dependencyResults) {
        parts.push("---");
        parts.push("步骤 ID: " + dep.stepId);
        parts.push(
          dep.isError
            ? "错误: " + (dep.errorMessage ?? "未知错误")
            : "结果: " + dep.content.slice(0, 2000),
        );
        parts.push("");
      }
    }

    if (rules.length > 0) {
      parts.push("## 项目规则");
      for (const rule of rules) {
        parts.push("- [" + rule.category + "] " + rule.content);
      }
      parts.push("");
    }

    parts.push("请专注于完成这个子任务。调用必要的工具完成任务。");
    parts.push("完成后，输出最终结果。");

    return parts.join("\n");
  }
}

/**
 * 创建 SubAgentManager 实例
 */
export function createSubAgentManager(
  options: SubAgentManagerOptions,
): SubAgentManager {
  return new SubAgentManager(options);
}