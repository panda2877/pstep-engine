/**
 * MobileNav 组件
 * 移动端底部导航栏
 */

interface MobileNavProps {
  activeView: 'agents' | 'chat' | 'helper';
  onViewChange: (view: 'agents' | 'chat' | 'helper') => void;
}

export function MobileNav({ activeView, onViewChange }: MobileNavProps) {
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0"
      style={{
        height: 52,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-card)',
        zIndex: 100,
      }}
    >
      <div className="flex h-full">
        <MobileNavItem
          icon={<AgentIcon />}
          label="Agent"
          isActive={activeView === 'agents'}
          onClick={() => onViewChange('agents')}
        />
        <MobileNavItem
          icon={<ChatIcon />}
          label="聊天"
          isActive={activeView === 'chat'}
          onClick={() => onViewChange('chat')}
        />
        <MobileNavItem
          icon={<HelperIcon />}
          label="辅助"
          isActive={activeView === 'helper'}
          onClick={() => onViewChange('helper')}
        />
      </div>
    </div>
  );
}

function MobileNavItem({ icon, label, isActive, onClick }: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex-1 flex flex-col items-center justify-center gap-0.5"
      style={{
        border: 'none',
        background: 'transparent',
        color: isActive ? 'var(--accent-gold)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'color 0.2s',
      }}
      onClick={onClick}
    >
      {icon}
      <span className="text-[9px]">{label}</span>
    </button>
  );
}

function AgentIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HelperIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}
