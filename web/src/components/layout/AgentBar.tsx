/**
 * AgentBar 组件
 * 左侧 Agent 列表：显示多个 Agent 和会话
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import type { Agent, Session } from '../../services/api';

interface AgentBarProps {
  selectedAgent: string;
  selectedSession: string;
  onAgentSelect: (agent: string) => void;
  onSessionSelect: (session: string) => void;
}

export function AgentBar({
  selectedAgent,
  selectedSession,
  onAgentSelect,
  onSessionSelect,
}: AgentBarProps) {
  const { state, fetchAgents, fetchSessions, selectAgent } = useAppStore();
  const [expandedAgent, setExpandedAgent] = useState<string | null>(selectedAgent);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 加载 Agent 列表
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // 加载选中 Agent 的会话列表
  useEffect(() => {
    if (state.selectedAgentId) {
      fetchSessions(state.selectedAgentId);
    }
  }, [state.selectedAgentId, fetchSessions]);

  const handleAgentClick = (agent: Agent) => {
    // 折叠/展开
    const newExpanded = expandedAgent === agent.name ? null : agent.name;
    setExpandedAgent(newExpanded);

    // 选中 Agent
    selectAgent(agent.id);
    onAgentSelect(agent.name);

    // 默认选中第一个会话
    if (newExpanded && state.sessions.length > 0) {
      onSessionSelect(state.sessions[0].id);
    }
  };

  const handleSessionClick = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    if (state.selectedAgentId) {
      selectAgent(state.selectedAgentId);
    }
    onSessionSelect(session.id);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    }
  };

  return (
    <div
      className="hidden md:flex flex-col flex-shrink-0"
      style={{
        width: 'var(--agent-width)',
        minWidth: 'var(--agent-width)',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-card)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-card)',
          fontSize: 10,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        <span>agents</span>
        <button
          className="flex items-center justify-center hover:opacity-80"
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          title="新建 Agent"
          onClick={() => setShowCreateModal(true)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 6 }}>
        {state.agentsLoading && state.agents.length === 0 ? (
          <div className="flex items-center justify-center" style={{ padding: 20, color: 'var(--text-secondary)', fontSize: 11 }}>
            加载中...
          </div>
        ) : state.agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: 20, gap: 8 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>暂无 Agent</span>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--accent-gold)',
                background: 'transparent',
                color: 'var(--accent-gold)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              创建第一个 Agent
            </button>
          </div>
        ) : (
          state.agents.map((agent) => (
            <div key={agent.id} style={{ marginBottom: 2 }}>
              {/* Agent Item */}
              <div
                className="flex items-center cursor-pointer transition-all duration-200"
                style={{
                  gap: 8,
                  padding: '8px 8px 8px 6px',
                  borderRadius: 'var(--radius-card)',
                  background: selectedAgent === agent.name ? 'var(--bg-card)' : 'transparent',
                  borderLeft: selectedAgent === agent.name ? '2px solid var(--accent-gold)' : '2px solid transparent',
                }}
                onClick={() => handleAgentClick(agent)}
              >
                {/* Avatar */}
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                  }}
                >
                  <span className="font-semibold" style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {agent.initial || agent.name.charAt(0)}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center font-medium" style={{ fontSize: 12, gap: 6 }}>
                    <span>{agent.name}</span>
                    {selectedAgent === agent.name && (
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-green)' }} />
                    )}
                  </div>
                  <div
                    className="truncate"
                    style={{ fontSize: 10, marginTop: 1, color: 'var(--text-secondary)' }}
                  >
                    {agent.description || agent.soul?.role || ''}
                  </div>
                </div>

                {/* Chevron */}
                <span
                  className="flex-shrink-0 flex items-center justify-center transition-transform duration-200"
                  style={{
                    width: 16,
                    height: 16,
                    color: 'var(--text-secondary)',
                    transform: expandedAgent === agent.name ? 'rotate(90deg)' : 'rotate(0deg)',
                    fontSize: 10,
                  }}
                >
                  ▸
                </span>
              </div>

              {/* Sessions */}
              {expandedAgent === agent.name && (
                <div
                  className="block"
                  style={{
                    padding: '4px 0 6px 22px',
                    marginLeft: 12,
                    borderLeft: '1px dashed var(--border-card)',
                  }}
                >
                  {state.sessionsLoading ? (
                    <div style={{ padding: '8px', fontSize: 10, color: 'var(--text-secondary)' }}>
                      加载会话...
                    </div>
                  ) : state.sessions.length === 0 ? (
                    <div style={{ padding: '8px', fontSize: 10, color: 'var(--text-secondary)' }}>
                      暂无会话
                    </div>
                  ) : (
                    state.sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center cursor-pointer transition-all duration-150"
                        style={{
                          gap: 6,
                          padding: '5px 8px',
                          borderRadius: 4,
                          marginBottom: 1,
                          fontSize: 11,
                          color: selectedSession === session.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                          background: selectedSession === session.id ? 'rgba(212, 168, 83, 0.12)' : 'transparent',
                        }}
                        onClick={(e) => handleSessionClick(e, session)}
                      >
                        <div
                          className="flex-shrink-0"
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            background: selectedSession === session.id ? 'var(--accent-gold)' : 'currentColor',
                            opacity: selectedSession === session.id ? 1 : 0.6,
                          }}
                        />
                        <span className="flex-1 min-w-0 truncate">{session.title || '新会话'}</span>
                        <span className="flex-shrink-0" style={{ fontSize: 9, opacity: 0.7 }}>
                          {formatTime(session.updatedAt)}
                        </span>
                      </div>
                    ))
                  )}

                  {/* New Session Button */}
                  <div
                    className="flex items-center cursor-pointer opacity-0 hover:opacity-100 transition-opacity"
                    style={{
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      color: 'var(--text-secondary)',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: 新建会话
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>新建会话</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create Agent Modal */}
      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// 创建 Agent 弹窗
// ============================================================================

function CreateAgentModal({ onClose }: { onClose: () => void }) {
  const { createAgent, selectAgent } = useAppStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [personality, setPersonality] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !role.trim()) return;
    setLoading(true);
    try {
      const id = await createAgent({
        name: name.trim(),
        initial: name.trim().charAt(0),
        description: description.trim() || undefined,
        soul: {
          role: role.trim(),
          personality: personality.trim() || '',
          responsibilities: '',
        },
      });
      selectAgent(id);
      onClose();
    } catch (err) {
      console.error('[AgentBar] Failed to create agent:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 12,
          padding: 20,
          width: 320,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
          新建 Agent
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              名称 *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：紫灵"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              描述
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：需求/创意专家"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              角色定义 *
            </label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="例如：需求分析专家"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              性格特点
            </label>
            <input
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder="例如：傲娇、创意十足"
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--border-card)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !role.trim() || loading}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--accent-gold)',
              color: '#1a1a1a',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              opacity: !name.trim() || !role.trim() || loading ? 0.5 : 1,
            }}
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  );
}
