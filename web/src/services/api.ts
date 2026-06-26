/**
 * API 客户端封装
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() || 'GET';
  const hasBody = method === 'POST' || method === 'PUT';
  const res = await fetch(`${API_BASE}${url}`, {
    headers: hasBody ? { 'Content-Type': 'application/json', ...options?.headers } : { ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ============================================================================
// Agent API
// ============================================================================

export interface AgentSoul {
  role: string;
  personality: string;
  responsibilities: string;
  catchphrase?: string;
}

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

export interface CreateAgentRequest {
  name: string;
  initial?: string;
  description?: string;
  soul: AgentSoul;
}

export const agentApi = {
  list: () => request<{ agents: Agent[] }>('/api/agents'),

  get: (id: string) => request<Agent>(`/api/agents/${id}`),

  create: (data: CreateAgentRequest) =>
    request<{ id: string; status: string }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateAgentRequest & { status: 'active' | 'inactive' }>) =>
    request<Agent>(`/api/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ status: string }>(`/api/agents/${id}`, {
      method: 'DELETE',
    }),

  sessions: (id: string) =>
    request<{ sessions: Session[] }>(`/api/agents/${id}/sessions`),
};

// ============================================================================
// Session API
// ============================================================================

export interface Session {
  id: string;
  projectId: string;
  agentId?: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateSessionRequest {
  projectId: string;
  agentId?: string;
  title?: string;
}

export const sessionApi = {
  list: (params: { projectId?: string; agentId?: string }) => {
    const query = new URLSearchParams();
    if (params.projectId) query.set('projectId', params.projectId);
    if (params.agentId) query.set('agentId', params.agentId);
    return request<{ sessions: Session[] }>(`/api/sessions?${query.toString()}`);
  },

  get: (id: string) =>
    request<Session & { messages: any[]; agent?: Agent }>(`/api/sessions/${id}`),

  create: (data: CreateSessionRequest) =>
    request<{ id: string; projectId: string; agentId?: string; status: string }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ status: string }>(`/api/sessions/${id}`, {
      method: 'DELETE',
    }),

  update: (id: string, data: { title?: string }) =>
    request<Session>(`/api/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  messages: (id: string) =>
    request<{ messages: Message[]; agent?: Agent }>(`/api/sessions/${id}`),
};

// ============================================================================
// Message API
// ============================================================================

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: string;
  createdAt: number;
}

export const messageApi = {
  search: (params: { sessionId: string; query: string }) => {
    const query = new URLSearchParams(params);
    return request<{ results: Message[]; total: number }>(`/api/messages/search?${query.toString()}`);
  },
};

// ============================================================================
// Memory API
// ============================================================================

export interface MemoryEntry {
  id: string;
  projectId: string;
  category: string;
  summary: string;
  sourceSessionId?: string;
  createdAt: number;
}

export const memoryApi = {
  list: (params: { projectId: string; category?: string }) => {
    const query = new URLSearchParams({ projectId: params.projectId });
    if (params.category) query.set('category', params.category);
    return request<{ memories: MemoryEntry[] }>(`/api/memory?${query.toString()}`);
  },

  create: (data: { projectId: string; category: string; summary: string; sourceSessionId?: string }) =>
    request<MemoryEntry>('/api/memory', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ status: string }>(`/api/memory/${id}`, {
      method: 'DELETE',
    }),
};

// ============================================================================
// Chat API (SSE via POST)
// ============================================================================

export interface ChatRequest {
  projectId: string;
  agentId?: string;
  sessionId?: string;
  message: string;
  stream?: boolean;
}

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

/**
 * 创建聊天流（使用 fetch + ReadableStream 读取 SSE）
 * 返回 abort 函数用于取消请求
 */
export function createChatStream(
  params: ChatRequest,
  onMessage: (msg: SSEMessage) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): () => void {
  const controller = new AbortController();
  let done = false;

  const safeDone = () => {
    if (done) return;
    done = true;
    onDone();
  };

  (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: params.projectId,
          agentId: params.agentId,
          sessionId: params.sessionId,
          message: params.message,
          stream: params.stream ?? true,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let eventType = '';
      let eventData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          } else if (line === '' && eventData) {
            // 空行表示事件结束
            if (eventType === 'done') {
              safeDone();
              return;
            }
            if (eventType === 'message' || eventType === 'error') {
              try {
                const data = JSON.parse(eventData) as SSEMessage;
                onMessage(data);
              } catch (e) {
                console.error('[Chat] Failed to parse SSE data:', e);
              }
            }
            eventType = '';
            eventData = '';
          }
        }
      }

      // 流结束（如果还有未处理的事件）
      if (eventData) {
        if (eventType !== 'done') {
          try {
            const data = JSON.parse(eventData) as SSEMessage;
            onMessage(data);
          } catch {}
        }
      }
      safeDone();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    }
  })();

  return () => controller.abort();
}
