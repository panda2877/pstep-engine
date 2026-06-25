/**
 * 全局状态管理
 * 使用 React Context + useReducer，无需额外依赖
 */

import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react';
import { agentApi, sessionApi, type Agent, type Session } from '../services/api';

// ============================================================================
// State 类型
// ============================================================================

export interface AppState {
  // Agent 状态
  agents: Agent[];
  selectedAgentId: string | null;
  agentsLoading: boolean;

  // Session 状态
  sessions: Session[];
  selectedSessionId: string | null;
  sessionsLoading: boolean;

  // UI 状态
  helperOpen: boolean;
  mobileView: 'agents' | 'chat' | 'helper';
  activeView: 'chat' | 'setting';
}

const initialState: AppState = {
  agents: [],
  selectedAgentId: null,
  agentsLoading: false,
  sessions: [],
  selectedSessionId: null,
  sessionsLoading: false,
  helperOpen: true,
  mobileView: 'chat',
  activeView: 'chat',
};

// ============================================================================
// Action 类型
// ============================================================================

type AppAction =
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'SET_SELECTED_AGENT'; payload: string | null }
  | { type: 'SET_AGENTS_LOADING'; payload: boolean }
  | { type: 'ADD_AGENT'; payload: Agent }
  | { type: 'UPDATE_AGENT'; payload: Agent }
  | { type: 'REMOVE_AGENT'; payload: string }
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'SET_SELECTED_SESSION'; payload: string | null }
  | { type: 'SET_SESSIONS_LOADING'; payload: boolean }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'SET_HELPER_OPEN'; payload: boolean }
  | { type: 'SET_MOBILE_VIEW'; payload: 'agents' | 'chat' | 'helper' }
  | { type: 'SET_ACTIVE_VIEW'; payload: 'chat' | 'setting' };

// ============================================================================
// Reducer
// ============================================================================

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_AGENTS':
      return { ...state, agents: action.payload };
    case 'SET_SELECTED_AGENT':
      return { ...state, selectedAgentId: action.payload };
    case 'SET_AGENTS_LOADING':
      return { ...state, agentsLoading: action.payload };
    case 'ADD_AGENT':
      return { ...state, agents: [action.payload, ...state.agents] };
    case 'UPDATE_AGENT':
      return {
        ...state,
        agents: state.agents.map(a => a.id === action.payload.id ? action.payload : a),
      };
    case 'REMOVE_AGENT':
      return {
        ...state,
        agents: state.agents.filter(a => a.id !== action.payload),
        selectedAgentId: state.selectedAgentId === action.payload ? null : state.selectedAgentId,
      };
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'SET_SELECTED_SESSION':
      return { ...state, selectedSessionId: action.payload };
    case 'SET_SESSIONS_LOADING':
      return { ...state, sessionsLoading: action.payload };
    case 'ADD_SESSION':
      return { ...state, sessions: [action.payload, ...state.sessions] };
    case 'REMOVE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.payload),
        selectedSessionId: state.selectedSessionId === action.payload ? null : state.selectedSessionId,
      };
    case 'SET_HELPER_OPEN':
      return { ...state, helperOpen: action.payload };
    case 'SET_MOBILE_VIEW':
      return { ...state, mobileView: action.payload };
    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.payload };
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // 便捷方法
  fetchAgents: () => Promise<void>;
  fetchSessions: (agentId: string) => Promise<void>;
  selectAgent: (agentId: string) => void;
  selectSession: (sessionId: string) => void;
  createAgent: (data: { name: string; initial?: string; description?: string; soul: any }) => Promise<string>;
  createSession: (data: { projectId: string; agentId?: string; title?: string }) => Promise<string>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const fetchAgents = useCallback(async () => {
    dispatch({ type: 'SET_AGENTS_LOADING', payload: true });
    try {
      const { agents } = await agentApi.list();
      dispatch({ type: 'SET_AGENTS', payload: agents });
      // 自动选中第一个 Agent
      if (agents.length > 0 && !state.selectedAgentId) {
        dispatch({ type: 'SET_SELECTED_AGENT', payload: agents[0].id });
      }
    } catch (err) {
      console.error('[Store] Failed to fetch agents:', err);
    } finally {
      dispatch({ type: 'SET_AGENTS_LOADING', payload: false });
    }
  }, [state.selectedAgentId]);

  const fetchSessions = useCallback(async (agentId: string) => {
    dispatch({ type: 'SET_SESSIONS_LOADING', payload: true });
    try {
      const { sessions } = await sessionApi.list({ agentId });
      dispatch({ type: 'SET_SESSIONS', payload: sessions });
    } catch (err) {
      console.error('[Store] Failed to fetch sessions:', err);
    } finally {
      dispatch({ type: 'SET_SESSIONS_LOADING', payload: false });
    }
  }, []);

  const selectAgent = useCallback((agentId: string) => {
    dispatch({ type: 'SET_SELECTED_AGENT', payload: agentId });
    dispatch({ type: 'SET_SELECTED_SESSION', payload: null });
    fetchSessions(agentId);
  }, [fetchSessions]);

  const selectSession = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_SELECTED_SESSION', payload: sessionId });
  }, []);

  const createAgent = useCallback(async (data: { name: string; initial?: string; description?: string; soul: any }) => {
    const { id } = await agentApi.create(data);
    // 重新获取列表以获取完整数据
    await fetchAgents();
    return id;
  }, [fetchAgents]);

  const createSession = useCallback(async (data: { projectId: string; agentId?: string; title?: string }) => {
    const { id } = await sessionApi.create(data);
    if (data.agentId) {
      await fetchSessions(data.agentId);
    }
    return id;
  }, [fetchSessions]);

  return (
    <AppContext.Provider value={{
      state,
      dispatch,
      fetchAgents,
      fetchSessions,
      selectAgent,
      selectSession,
      createAgent,
      createSession,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppStore must be used within AppProvider');
  }
  return ctx;
}
