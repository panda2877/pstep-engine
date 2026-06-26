/**
 * Agent 编排器
 * 接收 web 请求 -> 构建 Agent -> 流式返回（含 LLM token 实时透传）
 */

import { Agent, type AgentOptions, type AgentEvent, type AgentMessage } from "@earendil-works/pi-agent-core";
import type { PstepMessage, StreamingMessage } from "../types/messages.js";
import { createPlanSolveLoop, type PlanSolveLoopOptions } from "./plan-solve-loop.js";
import { randomUUID } from "crypto";

/**
 * 历史消息条目（从持久化存储加载）
 */
export interface HistoryEntry {
  role: "user" | "assistant";
  content: string;
}

/**
 * 编排器配置
 */
export interface OrchestratorOptions {
  gatewayUrl: string;
  model?: string;
  systemPrompt?: string;
  planSolveOptions?: PlanSolveLoopOptions;
  /** 加载指定会话的历史消息（用于多轮上下文） */
  loadHistory?: (sessionId: string) => Promise<HistoryEntry[]>;
  /** 保存本次执行产生的新消息 */
  saveMessages?: (sessionId: string, entries: HistoryEntry[]) => Promise<void>;
}

/**
 * 消息队列，用于在 subscribe 回调和 async generator 之间传递消息
 */
class MessageQueue {
  private queue: PstepMessage[] = [];
  private resolvers: Array<(msg: PstepMessage) => void> = [];
  private closed = false;

  /** 推送消息到队列 */
  push(msg: PstepMessage): void {
    if (this.closed) return;
    if (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(msg);
    } else {
      this.queue.push(msg);
    }
  }

  /** 从队列中获取消息（异步等待） */
  async next(): Promise<PstepMessage | null> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    if (this.closed) {
      return null;
    }
    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  /** 关闭队列 */
  close(): void {
    this.closed = true;
    // 唤醒所有等待的消费者
    while (this.resolvers.length > 0) {
      const resolve = this.resolvers.shift()!;
      resolve(null as any);
    }
  }

  /** 检查队列是否为空 */
  isEmpty(): boolean {
    return this.queue.length === 0 && this.resolvers.length === 0;
  }
}

/**
 * Agent 编排器
 */
export class Orchestrator {
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions) {
    this.options = {
      gatewayUrl: options.gatewayUrl,
      model: options.model ?? "sensenova",
      systemPrompt: options.systemPrompt,
      planSolveOptions: options.planSolveOptions ?? {},
      loadHistory: options.loadHistory,
      saveMessages: options.saveMessages,
    };
  }

  /**
   * 处理聊天请求
   * 返回 PstepMessage 的异步迭代器（SSE 流）
   * 包含 LLM token 实时透传（message_start/update/end）和工具执行事件
   */
  async *execute(
    userMessage: string,
    projectId: string,
    sessionId: string
  ): AsyncIterable<PstepMessage> {
    const systemPrompt = this.buildSystemPrompt(projectId);
    const loop = createPlanSolveLoop(projectId, this.options.planSolveOptions);

    const gatewayBaseUrl = this.options.gatewayUrl.endsWith("/v1") ? this.options.gatewayUrl : this.options.gatewayUrl + "/v1";
    const modelConfig = {
      id: "mimo-v2.5",
      name: "Mimo v2.5",
      api: "openai-completions",
      provider: "openai",
      baseUrl: gatewayBaseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: Number(process.env.LLM_MAX_TOKENS) || 4096,
    };
    const gatewayApiKey = process.env.GATEWAY_API_KEY;

    // 加载历史消息（用于多轮上下文）
    let historyMessages: AgentMessage[] = [];
    if (this.options.loadHistory) {
      try {
        const entries = await this.options.loadHistory(sessionId);
        historyMessages = entries.map((e) => ({
          role: e.role as "user" | "assistant",
          content: e.content,
          timestamp: Date.now(),
        })) as AgentMessage[];
      } catch (err) {
        console.error("[Orchestrator] failed to load history:", (err as Error).message);
      }
    }

    const agentOptions: AgentOptions = {
      initialState: {
        model: modelConfig as any,
        systemPrompt,
        messages: historyMessages,
      },
      sessionId,
      ...(gatewayApiKey ? { getApiKey: () => gatewayApiKey } : {}),
    };

    const agent = new Agent(agentOptions);

    // 消息队列，用于在 subscribe 回调和 async generator 之间传递消息
    const queue = new MessageQueue();

    // 当前流式消息的累积内容
    let currentStreamingContent = "";
    let currentStreamingRole: "assistant" | "tool" = "assistant";
    let currentToolCallId: string | null = null;
    let currentToolName: string | null = null;

    // 已完成轮次的内容累积（PSV 循环可能有多轮 assistant 回复）
    // 每轮 message_end 时把该轮最终文本追加到这里
    let allTurnsContent = "";

    // 收集本轮最终的 assistant 文本（用于历史持久化）
    // 用 message_end 触发，保存的是 message 整体的最终内容（非流式快照）
    const finalAssistantContents: string[] = [];

    // 订阅所有 AgentEvent 类型，不仅限于 turn_end
    const unsubscribe = agent.subscribe(async (event: AgentEvent) => {
      switch (event.type) {
        case "message_start":
          // 新的消息开始 — 上一轮已结束，把上轮最终内容追加到 allTurnsContent
          if (currentStreamingContent && currentStreamingRole === "assistant") {
            if (allTurnsContent) allTurnsContent += "\n\n";
            allTurnsContent += currentStreamingContent;
          }
          currentStreamingRole = event.message.role === "assistant" ? "assistant" : "tool";
          currentStreamingContent = "";
          currentToolCallId = null;
          currentToolName = null;

          // 检查是否是工具调用消息
          const msgContent = (event.message as any).content;
          if (msgContent && Array.isArray(msgContent) && msgContent.length > 0) {
            const firstBlock = msgContent[0];
            if (firstBlock && firstBlock.type === "toolCall") {
              currentToolCallId = firstBlock.id;
              currentToolName = firstBlock.name;
            }
          }
          break;

        case "message_update":
          // LLM token 实时推送
          const rawContent = (event.message as any).content;
          let content = "";
          if (typeof rawContent === "string") {
            content = rawContent;
          } else if (Array.isArray(rawContent)) {
            blockLoop: for (const block of rawContent) {
              if (block.type === "text" && block.text) {
                content = block.text;
                break blockLoop;
              } else if (block.type === "thinking" && block.thinking) {
                content = block.thinking;
                break blockLoop;
              } else if (block.type === "toolCall") {
                currentToolCallId = block.id;
                currentToolName = block.name;
              }
            }
          }
          if (content) {
            currentStreamingContent = content;
            // 发送 allTurnsContent + 当前轮内容，前端无需自行累积
            const fullContent = allTurnsContent
              ? allTurnsContent + "\n\n" + content
              : content;
            queue.push({
              id: randomUUID(),
              role: "assistant",
              createdAt: Date.now(),
              type: "streaming",
              content: fullContent,
              isToolCall: false,
              isPartial: true,
            });
          }
          break;

        case "message_end": {
          // 消息结束，输出最终的 streaming 消息（含所有轮次累积内容）
          if (currentStreamingContent || currentToolCallId) {
            const endFullContent = allTurnsContent
              ? allTurnsContent + "\n\n" + currentStreamingContent
              : currentStreamingContent;
            queue.push(
              this.createStreamingMessage(
                randomUUID(),
                endFullContent,
                currentStreamingRole,
                currentToolCallId || undefined,
                currentToolName || undefined
              )
            );
          }
          // 收集最终 assistant 文本（用于历史持久化）
          const endMsg = (event as any).message;
          if (endMsg && endMsg.role === "assistant") {
            const blocks = endMsg.content;
            if (Array.isArray(blocks)) {
              const textBlock = blocks.find((b: any) => b.type === "text" && b.text);
              if (textBlock) {
                finalAssistantContents.push(textBlock.text);
                // 同步更新 allTurnsContent，确保下一轮能衔接
                if (allTurnsContent) allTurnsContent += "\n\n";
                allTurnsContent += textBlock.text;
              }
            }
          }
          console.log(`[Orchestrator] message_end: finalAssistantContents=${finalAssistantContents.length}, allTurnsContent length=${allTurnsContent.length}`);
          currentStreamingContent = "";
          currentToolCallId = null;
          currentToolName = null;
          break;
        }

        case "tool_execution_start":
          // 工具执行开始
          queue.push({
            id: randomUUID(),
            role: "assistant",
            type: "streaming",
            content: `正在执行工具: ${event.toolName}`,
            createdAt: Date.now(),
            isToolCall: true,
            toolName: event.toolName,
            toolCallId: event.toolCallId,
          } as StreamingMessage);
          break;

        case "tool_execution_end":
          // 工具执行结束
          queue.push({
            id: randomUUID(),
            role: "assistant",
            type: "streaming",
            content: `工具执行完成: ${event.toolName}`,
            createdAt: Date.now(),
            isToolCall: true,
            toolName: event.toolName,
            toolCallId: event.toolCallId,
          } as StreamingMessage);
          break;

        case "turn_end":
          // 轮次结束，触发 PSV 循环控制
          const steeringMsg = await loop.handleAgentEvent(agent, event);
          if (steeringMsg) {
            agent.steer(steeringMsg);
          }
          break;

        case "agent_end":
          break;

        // 其他事件类型暂不转发（可根据需要扩展）
        case "agent_start":
        case "agent_end":
        case "turn_start":
        case "tool_execution_update":
          break;
      }
    });

    try {
      // 后台启动 Agent 执行（并发消费队列）
      const agentPromise = agent.prompt(userMessage)
        .then(() => agent.waitForIdle())
        .then(() => {
          // Agent 空闲后，检查是否完成
          const state = loop.getPhaseState();
          if (state.current === "completed") {
            queue.push({
              id: randomUUID(),
              role: "assistant",
              createdAt: Date.now(),
              type: "done",
              sessionId,
              messageCount: agent.state.messages.length,
              totalSteps: state.totalSteps,
              completedSteps: state.stepIndex,
              summary: "任务完成",
            });
          }
        })
        .finally(() => {
          queue.close();
        });

      // 并发消费队列 — 实时 yield streaming 消息
      while (true) {
        const msg = await queue.next();
        if (msg === null) {
          break;
        }
        yield msg;
      }

      // 等待 Agent 完全结束
      await agentPromise;
    } finally {
      queue.close();
      unsubscribe();

      // 保存本次对话消息（用于多轮上下文）
      // 放在 finally 中确保：即使客户端断开导致 generator 被提前 return，
      // 消息仍然会被持久化。
      console.log(`[Orchestrator] finally: saveMessages=${!!this.options.saveMessages}, finalAssistantContents=${finalAssistantContents.length}`);
      if (this.options.saveMessages) {
        try {
          const toSave: HistoryEntry[] = [{ role: "user", content: userMessage }];
          for (const content of finalAssistantContents) {
            if (content && content.trim().length > 0) {
              toSave.push({ role: "assistant", content });
            }
          }
          if (toSave.length > 0) {
            await this.options.saveMessages(sessionId, toSave);
            console.log(`[Orchestrator] saved ${toSave.length} messages for session ${sessionId}`);
          } else {
            console.warn(`[Orchestrator] nothing to save! finalAssistantContents=${finalAssistantContents.length}`);
          }
        } catch (err) {
          console.error("[Orchestrator] failed to save messages:", (err as Error).message);
        }
      }
    }
  }

  /**
   * 创建流式消息
   */
  private createStreamingMessage(
    id: string,
    content: string,
    role: "assistant" | "tool",
    toolCallId?: string,
    toolName?: string
  ): StreamingMessage {
    return {
      id,
      role,
      createdAt: Date.now(),
      type: "streaming",
      content,
      isToolCall: !!toolCallId,
      toolCallId,
      toolName,
    };
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
