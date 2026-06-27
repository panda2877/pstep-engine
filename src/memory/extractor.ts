/**
 * 记忆提取器
 * 使用 LLM 从对话中自动提取关键信息，存入 memory_entries
 */

import { MemoryDao } from '../db/dao.js';
import type { MemoryCategory } from '../types/rules.js';

// ============================================================================
// Types
// ============================================================================

interface ExtractedMemory {
  category: MemoryCategory;
  summary: string;
  importance: number;
}

interface ExtractionResult {
  memories: ExtractedMemory[];
}

// ============================================================================
// LLM Extraction Prompt
// ============================================================================

const EXTRACTION_PROMPT = `你是一个记忆提取助手。分析以下对话，提取关键信息并分类。

## 提取类别

### 用户记忆（user_*）
- user_identity: 用户的身份信息（职业、技能、角色）
- user_preference: 用户的偏好（技术栈、工具、风格）
- user_style: 用户的沟通风格（直接/委婉、详细/简洁）

### 项目记忆（project_*）
- project_decision: 项目中的重要技术/架构决策（选择了什么、为什么）
- project_context: 项目的当前状态、进度、背景信息

### Agent 记忆（agent_*）
- agent_experience: 从对话中学到的经验（用户喜欢什么、什么方法有效）

## 输出格式

返回 JSON 数组，每个元素包含：
- category: 类别名称（如 user_identity）
- summary: 简洁的一句话总结（不超过 50 字）
- importance: 重要性 0-100（50=一般，80=重要，90=关键）

## 规则
1. 只提取**明确提到**的信息，不要推测
2. 每条记忆应该独立、完整
3. 避免提取临时性信息（如"刚才"、"这次"）
4. 优先提取会影响未来对话的信息
5. 如果没有值得提取的信息，返回空数组 []

## 对话内容

`;

// ============================================================================
// Memory Extractor
// ============================================================================

export class MemoryExtractor {
  private gatewayUrl: string;
  private apiKey?: string;

  constructor(gatewayUrl: string, apiKey?: string) {
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
  }

  /**
   * 从对话中提取记忆
   */
  async extract(
    messages: Array<{ role: string; content: string }>,
    projectId: string,
    agentId?: string,
    sourceSessionId?: string
  ): Promise<number> {
    if (!messages || messages.length === 0) {
      console.log('[MemoryExtractor] No messages to extract from');
      return 0;
    }

    console.log(`[MemoryExtractor] Extracting from ${messages.length} messages`);

    // 构建对话内容
    const conversation = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
      .join('\n\n');

    if (conversation.trim().length === 0) {
      console.log('[MemoryExtractor] No meaningful conversation content');
      return 0;
    }

    // 调用 LLM 提取
    const extracted = await this.callLlm(conversation);
    if (!extracted || extracted.memories.length === 0) return 0;

    // 去重并存储
    let storedCount = 0;
    for (const memory of extracted.memories) {
      const isDuplicate = this.checkDuplicate(memory, projectId);
      if (!isDuplicate) {
        MemoryDao.create({
          projectId,
          agentId,
          category: memory.category,
          summary: memory.summary,
          importance: memory.importance,
          source: 'auto',
          sourceSessionId,
        });
        storedCount++;
      }
    }

    console.log(`[MemoryExtractor] Extracted ${extracted.memories.length} memories, stored ${storedCount} new ones`);
    return storedCount;
  }

  /**
   * 调用 LLM 进行提取
   */
  private async callLlm(conversation: string): Promise<ExtractionResult | null> {
    const baseUrl = this.gatewayUrl.endsWith('/v1')
      ? this.gatewayUrl
      : this.gatewayUrl + '/v1';

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: 'mimo-v2.5',
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: conversation.slice(0, 8000) }, // 限制长度
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error(`[MemoryExtractor] LLM request failed: ${response.status}`);
        return null;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      // 解析 JSON（兼容 markdown code block）
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1]?.trim() || content.trim();

      console.log(`[MemoryExtractor] LLM response: ${jsonStr.substring(0, 200)}...`);

      const result = JSON.parse(jsonStr) as ExtractionResult;
      console.log(`[MemoryExtractor] Parsed ${result.memories?.length ?? 0} memories`);
      return result;
    } catch (err) {
      console.error('[MemoryExtractor] LLM extraction failed:', (err as Error).message);
      return null;
    }
  }

  /**
   * 检查是否重复（简单的相似度检查）
   */
  private checkDuplicate(memory: ExtractedMemory, projectId: string): boolean {
    const existing = MemoryDao.findByCategory(projectId, memory.category);
    for (const item of existing) {
      // 简单的关键词重叠检查
      if (this.calculateOverlap(memory.summary, item.summary) > 0.6) {
        return true;
      }
    }
    return false;
  }

  /**
   * 计算两个字符串的关键词重叠度
   */
  private calculateOverlap(a: string, b: string): number {
    const wordsA = new Set(a.split(/[\s,，。、；：！？]+/).filter((w) => w.length > 1));
    const wordsB = new Set(b.split(/[\s,，。、；：！？]+/).filter((w) => w.length > 1));
    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    let overlap = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) overlap++;
    }
    return overlap / Math.max(wordsA.size, wordsB.size);
  }
}

/**
 * 创建记忆提取器实例
 */
export function createMemoryExtractor(gatewayUrl: string, apiKey?: string): MemoryExtractor {
  return new MemoryExtractor(gatewayUrl, apiKey);
}
