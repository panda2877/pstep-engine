/**
 * FnBar 组件
 * 左侧功能栏：视图切换
 */

interface FnBarProps {
  activeView: 'chat' | 'setting';
  onViewChange: (view: 'chat' | 'setting') => void;
}

export function FnBar({ activeView, onViewChange }: FnBarProps) {
  return (
    <div
      className="flex flex-col items-center py-3 gap-1"
      style={{
        width: 'var(--fn-width)',
        minWidth: 'var(--fn-width)',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-card)',
      }}
    >
      {/* Chat Button */}
      <button
        className="tooltip"
        data-tip="聊天"
        onClick={() => onViewChange('chat')}
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-btn)',
          border: 'none',
          background: activeView === 'chat' ? 'var(--bg-card)' : 'transparent',
          color: activeView === 'chat' ? 'var(--accent-gold)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: activeView === 'chat' ? 'inset 2px 0 0 var(--accent-gold)' : 'none',
        }}
      >
        <ChatIcon />
      </button>

      {/* Setting Button */}
      <button
        className="tooltip"
        data-tip="设置"
        onClick={() => onViewChange('setting')}
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-btn)',
          border: 'none',
          background: activeView === 'setting' ? 'var(--bg-card)' : 'transparent',
          color: activeView === 'setting' ? 'var(--accent-gold)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: activeView === 'setting' ? 'inset 2px 0 0 var(--accent-gold)' : 'none',
        }}
      >
        <SettingIcon />
      </button>

      {/* Spacer */}
      <div className="flex-1" />
    </div>
  );
}

function ChatIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SettingIcon() {
  return (
    <svg className="icon" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
