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
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-main)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        <span>agents</span>
        <button
          className="flex items-center justify-center hover:opacity-80"
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
          }}
          title="新建 Agent"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto flex flex-col px-2 gap-0.5">
        {MOCK_AGENTS.map((agent) => (
          <div key={agent.id} className="mb-0.5">
            {/* Agent Item */}
            <div
              className="flex items-center gap-2 py-2 px-2 rounded-lg cursor-pointer transition-all duration-200"
              style={{
                background: selectedAgent === agent.name ? 'var(--bg-active)' : 'transparent',
              }}
              onClick={() => handleAgentClick(agent)}
            >
              {/* Avatar */}
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-card)' }}
              >
                <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {agent.initial}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-medium">
                  <span>{agent.name}</span>
                  {selectedAgent === agent.name && (
                    <div className="w-1 h-1 rounded-full" style={{ background: 'var(--accent-green)' }} />
                  )}
                </div>
                <div
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {agent.description}
                </div>
              </div>

              {/* Chevron */}
              <span
                className="flex-shrink-0 text-[10px] transition-transform duration-200"
                style={{
                  color: 'var(--text-secondary)',
                  transform: expandedAgent === agent.name ? 'rotate(90deg)' : 'rotate(0deg)',
                }}
              >
                ▸
              </span>
            </div>

            {/* Sessions */}
            {expandedAgent === agent.name && (
              <div className="hidden lg:block py-2">
                <div className="px-4 pb-1.5 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                  当前会话
                </div>
                <div className="flex flex-col gap-px">
                  {agent.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center gap-2 py-1.5 px-4 cursor-pointer transition-all duration-150"
                      style={{
                        color: selectedSession === session.name ? 'var(--accent-gold)' : 'var(--text-secondary)',
                        background: selectedSession === session.name ? 'var(--bg-active)' : 'transparent',
                      }}
                      onClick={(e) => handleSessionClick(e, agent, session)}
                    >
                      <span className="flex-1 text-[13px] truncate">{session.name}</span>
                      <span className="text-[11px] text-[var(--text-muted)] flex-shrink-0">{session.time}</span>
                    </div>
                  ))}
                </div>

                {/* New Session Button */}
                <div
                  className="flex items-center gap-1 py-1.5 px-4 cursor-pointer text-[11px] opacity-0 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
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
