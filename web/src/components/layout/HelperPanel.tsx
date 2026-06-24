/**
 * HelperPanel 组件
 * 右侧辅助面板：User、Soul、Memory 标签页
 */

import { useState } from 'react';

interface HelperPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
}

type TabType = 'user' | 'soul' | 'memory';

export function HelperPanel({ isOpen, onClose, isMobile = false }: HelperPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('user');

  const tabTitles: Record<TabType, string> = {
    user: 'User Memory',
    soul: 'Soul Definition',
    memory: 'LanceDB Memory',
  };

  if (isMobile) {
    return (
      <div
        className="fixed inset-0 z-50 flex-col"
        style={{
          width: '100%',
          background: 'var(--bg-secondary)',
        }}
      >
        <PanelBody activeTab={activeTab} setActiveTab={setActiveTab} tabTitles={tabTitles} onClose={onClose} />
      </div>
    );
  }

  return (
    <div
      className="hidden md:flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{
        width: isOpen ? 'clamp(280px, 28%, 400px)' : '28px',
        minWidth: isOpen ? 'clamp(280px, 28%, 400px)' : '28px',
        maxWidth: isOpen ? 'clamp(280px, 28%, 400px)' : '28px',
        background: 'var(--bg-secondary)',
        borderLeft: '1px solid var(--border-card)',
        overflow: 'hidden',
      }}
    >
      {isOpen ? (
        <PanelBody activeTab={activeTab} setActiveTab={setActiveTab} tabTitles={tabTitles} onClose={onClose} />
      ) : (
        <CollapsedRail onExpand={onClose} />
      )}
    </div>
  );
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <button
      onClick={onExpand}
      title="展开辅助面板"
      className="flex-1 flex flex-col items-center justify-center cursor-pointer"
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        padding: 8,
        gap: 8,
      }}
    >
      <svg className="icon icon-sm" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="15" y1="3" x2="15" y2="21" />
        <polyline points="10 9 7 12 10 15" />
      </svg>
      <span
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontSize: 11,
          letterSpacing: 2,
        }}
      >
        Helper
      </span>
    </button>
  );
}

function PanelBody({
  activeTab,
  setActiveTab,
  tabTitles,
  onClose,
}: {
  activeTab: TabType;
  setActiveTab: (t: TabType) => void;
  tabTitles: Record<TabType, string>;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-card)' }}
      >
        <span className="text-xs font-medium">{tabTitles[activeTab]}</span>
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
          onClick={onClose}
          title="折叠辅助面板"
        >
          <svg className="icon icon-sm" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
            <polyline points="14 9 17 12 14 15" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-card)' }}
      >
        {(['user', 'soul', 'memory'] as TabType[]).map((tab) => (
          <button
            key={tab}
            className="flex-1 py-2 text-[11px] transition-all"
            style={{
              border: 'none',
              background: 'transparent',
              color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-secondary)',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid var(--accent-gold)' : '2px solid transparent',
              marginBottom: -1,
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2.5 min-h-0">
        {activeTab === 'user' && <UserTab />}
        {activeTab === 'soul' && <SoulTab />}
        {activeTab === 'memory' && <MemoryTab />}
      </div>
    </>
  );
}

function UserTab() {
  return (
    <div
      className="p-3 rounded-lg mb-2"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
      }}
    >
      <div
        className="text-[10px] mb-1.5 flex items-center gap-1.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg className="icon icon-sm" viewBox="0 0 24 24">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        User Profile
      </div>
      <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
{`**姓名**: 老大
**职业**: 项目管理（深圳）
**特点**: 按调用次数付费
**偏好**: 叫我「老大」即可`}
      </pre>
    </div>
  );
}

function SoulTab() {
  return (
    <div
      className="p-3 rounded-lg mb-2"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
      }}
    >
      <div
        className="text-[10px] mb-1.5 flex items-center gap-1.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg className="icon icon-sm" viewBox="0 0 24 24">
          <path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.4 6.5 6 8.5V22h6v-2.5c3.6-2 6-4.9 6-8.5a9 9 0 0 0-9-9z" />
        </svg>
        Soul Definition
      </div>
      <pre className="text-xs leading-relaxed whitespace-pre-wrap font-sans">
{`**角色**: 需求/创意专家
**性格**: 傲娇、创意十足
**职责**: 接收想法、可行性讨论
**口头禅**: "哼"、"等等！"`}
      </pre>
    </div>
  );
}

function MemoryTab() {
  return (
    <>
      <MemoryItem
        id="#001"
        content="项目根目录：/home/agentuser/public/hermes-dashboard\n后端BFF：backend/ | 前端：src/ | 启动脚本：./start.sh"
      />
      <MemoryItem
        id="#002"
        content="飞书群 chat_id：oc_08a798e06860c6b905f8090aec40208b\n图片识别：minimax-image-understanding skill"
      />
    </>
  );
}

function MemoryItem({ id, content }: { id: string; content: string }) {
  return (
    <div
      className="p-3 rounded-lg mb-2"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
      }}
    >
      <div
        className="text-[10px] mb-1.5 flex items-center gap-1.5"
        style={{ color: 'var(--text-secondary)' }}
      >
        <svg className="icon icon-sm" viewBox="0 0 24 24">
          <path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.4 6.5 6 8.5V22h6v-2.5c3.6-2 6-4.9 6-8.5a9 9 0 0 0-9-9z" />
          <path d="M12 2v4" />
        </svg>
        Memory {id}
      </div>
      <div className="text-xs leading-relaxed whitespace-pre-wrap">
        {content.split('\n').map((line, i) => (
          <span key={i}>
            {line}
            {i < content.split('\n').length - 1 && <br />}
          </span>
        ))}
      </div>
    </div>
  );
}
