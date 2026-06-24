/**
 * 类型定义
 */

export interface Agent {
  id: string;
  name: string;
  avatar?: string;
  initial?: string;
  description?: string;
  soul: AgentSoul;
  status: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}

export interface AgentSoul {
  role: string;
  personality: string;
  responsibilities: string;
  catchphrase?: string;
}

export interface Session {
  id: string;
  projectId: string;
  agentId?: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: string;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryEntry {
  id: string;
  projectId: string;
  category: string;
  summary: string;
  sourceSessionId?: string;
  createdAt: number;
}

export interface UserProfile {
  id: string;
  name: string;
  occupation?: string;
  preferences?: UserPreferences;
  createdAt: number;
  updatedAt: number;
}

export interface UserPreferences {
  callCountBilling?: boolean;
  nickname?: string;
}

// SSE 消息类型
export interface SSEMessage {
  type: 'plan' | 'step' | 'content' | 'done' | 'error';
  content?: string;
  steps?: string[];
  totalSteps?: number;
  stepIndex?: number;
  stepName?: string;
  status?: 'running' | 'completed' | 'failed';
  output?: string;
  sessionId?: string;
  messageCount?: number;
  completedSteps?: number;
  summary?: string;
  message?: string;
  code?: string;
  done?: boolean;
}

// API 请求/响应类型
export interface ChatRequest {
  projectId: string;
  agentId?: string;
  sessionId?: string;
  message: string;
  stream?: boolean;
}

export interface CreateSessionRequest {
  projectId: string;
  agentId?: string;
  title?: string;
}

export interface CreateAgentRequest {
  name: string;
  initial?: string;
  description?: string;
  soul: AgentSoul;
}
