/**
 * AgentBar 组件
 * 左侧 Agent 列表：显示多个 Agent 和会话
 */

import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  initial: string;
  description: string;
  sessions: Session[];
}

interface Session {
  id: string;
  name: string;
  time: string;
}

interface AgentBarProps {
  selectedAgent: string;
  selectedSession: string;
  onAgentSelect: (agent: string) => void;
  onSessionSelect: (session: string) => void;
}

// 临时使用静态数据，后续会从 API 获取
const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    name: '紫灵',
    initial: '紫',
    description: '需求/创意专家',
    sessions: [
      { id: '1', name: '当前会话', time: '14:23' },
      { id: '2', name: '跨端工具可行性分析', time: '5/10' },
      { id: '3', name: '需求调研初稿', time: '5/3' },
    ],
  },
  {
    id: '2',
    name: '幸如音',
    initial: '如',
    description: '技术实现专家',
    sessions: [
      { id: '4', name: 'Hermes Dashboard 讨论', time: '昨天' },
      { id: '5', name: 'BFF 层整合方案', time: '5/11' },
    ],
  },
  {
    id: '3',
    name: '文思月',
    initial: '思',
    description: '知识管理官',
    sessions: [
      { id: '6', name: '知识库梳理', time: '5/9' },
      { id: '7', name: '记忆系统升级', time: '4/28' },
    ],
  },
  {
    id: '4',
    name: '银月',
    initial: '银',
    description: '管家/调度',
    sessions: [
      { id: '8', name: '任务调度优化', time: '5/8' },
    ],
  },
];

export function AgentBar({
  selectedAgent,
  selectedSession,
  onAgentSelect,
  onSessionSelect,
}: AgentBarProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(selectedAgent);

  const handleAgentClick = (agent: Agent) => {
    // 折叠/展开
    const newExpanded = expandedAgent === agent.name ? null : agent.name;
    setExpandedAgent(newExpanded);

    // 选中 Agent
    onAgentSelect(agent.name);

    // 默认选中第一个会话
    if (newExpanded && agent.sessions.length > 0) {
      onSessionSelect(agent.sessions[0].name);
    }
  };

  const handleSessionClick = (e: React.MouseEvent, agent: Agent, session: Session) => {
    e.stopPropagation();
    onAgentSelect(agent.name);
    onSessionSelect(session.name);
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
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: 6 }}>
        {MOCK_AGENTS.map((agent) => (
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
                  {agent.initial}
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
                  {agent.description}
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
                className="hidden lg:block"
                style={{
                  padding: '4px 0 6px 22px',
                  marginLeft: 12,
                  borderLeft: '1px dashed var(--border-card)',
                }}
              >
                {agent.sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center cursor-pointer transition-all duration-150"
                    style={{
                      gap: 6,
                      padding: '5px 8px',
                      borderRadius: 4,
                      marginBottom: 1,
                      fontSize: 11,
                      color: selectedSession === session.name ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      background: selectedSession === session.name ? 'rgba(212, 168, 83, 0.12)' : 'transparent',
                    }}
                    onClick={(e) => handleSessionClick(e, agent, session)}
                  >
                    <div
                      className="flex-shrink-0"
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        background: selectedSession === session.name ? 'var(--accent-gold)' : 'currentColor',
                        opacity: selectedSession === session.name ? 1 : 0.6,
                      }}
                    />
                    <span className="flex-1 min-w-0 truncate">{session.name}</span>
                    <span className="flex-shrink-0" style={{ fontSize: 9, opacity: 0.7 }}>{session.time}</span>
                  </div>
                ))}

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
        ))}
      </div>
    </div>
  );
}
