/**
 * 类型定义
 * 从 services/api.ts 重新导出，保持类型一致性
 */

export type {
  Agent,
  AgentSoul,
  Session,
  Message,
  MemoryEntry,
  SSEMessage,
  ChatRequest,
  CreateSessionRequest,
  CreateAgentRequest,
} from '../services/api';

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
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
