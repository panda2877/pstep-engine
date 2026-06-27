/**
 * Agent 引擎核心
 * Phase 2: 完整的 Plan/Solve/Verify 循环
 */

import type { PstepMessage, Phase, PhaseState } from '../types/messages.js';
import { createOrchestrator } from '../agent/orchestrator.js';
import type { HistoryEntry } from '../agent/orchestrator.js';
import type { PlanSolveLoopOptions } from '../agent/plan-solve-loop.js';
import { RuleEngine, type RuleEngineOptions } from '../rules/rule-engine.js';
import { MemoryDao, AgentDao } from '../db/dao.js';
import type { MemoryEntry, AgentSoul } from '../types/rules.js';
import type { MemoryExtractor } from '../memory/extractor.js';

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
  /** 记忆提取器 */
  memoryExtractor?: MemoryExtractor;
}

/**
 * PstepEngine - Agent 逻辑引擎
 */
export class PstepEngine {
  private options: PstepEngineOptions;
  private orchestrator: ReturnType<typeof createOrchestrator> | null = null;
  private ruleEngine: RuleEngine;
  private memoryExtractor: MemoryExtractor | null;
  private phaseState: PhaseState = {
    current: 'plan',
    stepIndex: 0,
    totalSteps: 0,
  };

  constructor(options: PstepEngineOptions) {
    this.options = options;
    this.ruleEngine = new RuleEngine(options.ruleEngineOptions ?? {});
    this.memoryExtractor = options.memoryExtractor ?? null;
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
   * 构建系统提示词（包含项目规则 + 记忆 + Soul）
   */
  private async buildSystemPrompt(projectId: string, agentId?: string): Promise<string> {
    const basePrompt = this.options.systemPrompt ?? `
你是一位专业的 AI 编程助手，采用 Plan/Solve/Verify 范式工作：

1. **Plan（规划）**：分析任务，拆解为结构化步骤
2. **Solve（执行）**：逐步执行每个步骤，调用必要工具
3. **Verify（验证）**：验证每一步的结果，确保质量

请按此流程回答用户问题。
`;

    // 1. 通过规则引擎合并项目规则
    let prompt = await this.ruleEngine.mergeWithBasePrompt(basePrompt, projectId);

    // 2. 注入用户记忆
    const userIdentities = MemoryDao.findByCategory(projectId, 'user_identity');
    const userPreferences = MemoryDao.findByCategory(projectId, 'user_preference');
    const userStyles = MemoryDao.findByCategory(projectId, 'user_style');
    const userMemories = [...userIdentities, ...userPreferences, ...userStyles];
    if (userMemories.length > 0) {
      prompt += '\n\n---\n\n## 用户信息\n';
      for (const m of userMemories) {
        prompt += `- ${m.summary}\n`;
      }
    }

    // 3. 注入 Agent Soul + 经验
    if (agentId) {
      const agent = AgentDao.findById(agentId);
      if (agent) {
        const soul = agent.soul as AgentSoul;
        prompt += `\n\n---\n\n## 你是 ${agent.name}\n`;
        if (soul.role) prompt += `- 角色：${soul.role}\n`;
        if (soul.personality) prompt += `- 性格：${soul.personality}\n`;
        if (soul.responsibilities) prompt += `- 职责：${soul.responsibilities}\n`;
        if (soul.catchphrase) prompt += `- 口头禅：${soul.catchphrase}\n`;

        const experiences = MemoryDao.findByCategory(projectId, 'agent_experience');
        if (experiences.length > 0) {
          prompt += '\n### 你的经验\n';
          for (const e of experiences) {
            prompt += `- ${e.summary}\n`;
          }
        }
      }
    }

    // 4. 注入项目记忆
    const projectDecisions = MemoryDao.findByCategory(projectId, 'project_decision');
    const projectContexts = MemoryDao.findByCategory(projectId, 'project_context');
    const projectMemories = [...projectDecisions, ...projectContexts];
    if (projectMemories.length > 0) {
      prompt += '\n\n---\n\n## 项目上下文\n';
      for (const m of projectMemories) {
        prompt += `- ${m.summary}\n`;
      }
    }

    return prompt;
  }

  /**
   * 执行 Plan/Solve/Verify 循环
   */
  async *execute(userMessage: string, projectId: string, sessionId: string, agentId?: string): AsyncIterable<PstepMessage> {
    if (!this.orchestrator) {
      await this.initialize();
    }

    const systemPrompt = await this.buildSystemPrompt(projectId, agentId);

    // 临时覆盖 orchestrator 的 systemPrompt
    const originalBuild = (this.orchestrator as any).buildSystemPrompt;
    (this.orchestrator as any).buildSystemPrompt = () => systemPrompt;

    // 包装 saveMessages 以触发记忆提取
    const originalSaveMessages = this.options.saveMessages;
    const memoryExtractor = this.memoryExtractor;
    const wrappedSaveMessages = originalSaveMessages
      ? async (sid: string, entries: HistoryEntry[]) => {
          // 先保存消息
          await originalSaveMessages(sid, entries);
          // 然后异步提取记忆（不阻塞）
          if (memoryExtractor && entries.length > 0) {
            memoryExtractor
              .extract(entries, projectId, agentId, sid)
              .catch((err) => console.error('[PstepEngine] Memory extraction failed:', err.message));
          }
        }
      : undefined;

    // 临时覆盖 saveMessages
    const orchestratorAny = this.orchestrator as any;
    const originalOrchestratorSave = orchestratorAny.options?.saveMessages;
    if (wrappedSaveMessages) {
      orchestratorAny.options = { ...orchestratorAny.options, saveMessages: wrappedSaveMessages };
    }

    try {
      yield* this.orchestrator!.execute(userMessage, projectId, sessionId);
    } finally {
      // 恢复原始 saveMessages
      if (originalOrchestratorSave) {
        orchestratorAny.options.saveMessages = originalOrchestratorSave;
      }
    }
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
