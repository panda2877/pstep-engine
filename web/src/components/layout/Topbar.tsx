/**
 * Topbar 组件
 * 顶部导航栏：品牌、会话信息、连接状态
 * 移动端：< 返回按钮 + 辅助面板按钮
 */

import { useState, useEffect } from 'react';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

interface TopbarProps {
  /** 移动端：返回 Agent 列表 */
  onBack?: () => void;
  /** 移动端：切换辅助面板 */
  onToggleHelper?: () => void;
}

export function Topbar({ onBack, onToggleHelper }: TopbarProps) {
  const isMobile = useIsMobile();
  return (
    <div
      className="flex items-center justify-between flex-shrink-0"
      style={{
        height: 'var(--topbar-height)',
        minHeight: 'var(--topbar-height)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-card)',
        padding: '0 16px',
        gap: 16,
      }}
    >
      {/* Left Section */}
      <div className="flex items-center" style={{ gap: 12 }}>
        {/* Back button - 仅移动端显示 */}
        {isMobile && (
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Brand */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <PstepLogo />
          <span
            className="font-semibold"
            style={{ fontSize: 14, color: 'var(--text-primary)', letterSpacing: 0.3 }}
          >
            pstep
          </span>
        </div>

        {/* Divider */}
        <div
          className="hidden md:block w-px"
          style={{ height: 20, background: 'var(--border-card)' }}
        />

        {/* Session Info - 仅桌面端显示 */}
        <div className="hidden md:flex items-center" style={{ gap: 12 }}>
          <SessionInfoItem label="模型" value="minimax-main" highlight />
          <SessionInfoItem label="上下文" value="2,847 / 32,768" />
          <MilestoneBadge milestone="MS7" progress={25} />
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center" style={{ gap: 16 }}>
        {/* Connection Status - 仅桌面端显示 */}
        <div className="hidden md:block">
          <ConnectionStatus connected duration="8642" />
        </div>

        {/* Helper panel toggle - 仅移动端显示 */}
        {isMobile && (
          <button
            onClick={onToggleHelper}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              border: '1px solid var(--border-card)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function PstepLogo() {
  return (
    <svg
      className="w-[22px] h-[22px] flex-shrink-0"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="pstep"
    >
      <circle cx="6" cy="6.5" r="3.2" fill="#1a1a1a" />
      <circle cx="18" cy="6.5" r="3.2" fill="#1a1a1a" />
      <ellipse cx="12" cy="14" rx="8" ry="7.2" fill="#E8E6D9" />
      <ellipse cx="8.4" cy="13" rx="2" ry="2.4" fill="#1a1a1a" transform="rotate(-15 8.4 13)" />
      <ellipse cx="15.6" cy="13" rx="2" ry="2.4" fill="#1a1a1a" transform="rotate(15 15.6 13)" />
      <circle cx="8.5" cy="12.8" r="0.55" fill="#E8E6D9" />
      <circle cx="15.5" cy="12.8" r="0.55" fill="#E8E6D9" />
      <ellipse cx="12" cy="16.2" rx="1.1" ry="0.7" fill="#1a1a1a" />
      <path d="M10.8 18 Q12 19 13.2 18" stroke="#1a1a1a" strokeWidth="0.7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SessionInfoItem({ label, value, highlight = false }: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center text-[11px]" style={{ gap: 6, color: 'var(--text-secondary)' }}>
      <span className="opacity-70">{label}</span>
      <span
        className="font-medium"
        style={{ color: highlight ? 'var(--accent-gold)' : 'var(--text-primary)' }}
      >
        {value}
      </span>
    </div>
  );
}

function MilestoneBadge({ milestone, progress }: {
  milestone: string;
  progress: number;
}) {
  return (
    <div
      className="flex items-center rounded-xl text-[11px]"
      style={{
        gap: 8,
        padding: '4px 10px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
      }}
    >
      <span>{milestone}</span>
      <div
        className="rounded-full overflow-hidden"
        style={{ width: 60, height: 4, background: 'var(--border-card)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: 'var(--accent-green)',
          }}
        />
      </div>
      <span style={{ color: 'var(--text-secondary)' }}>{progress}%</span>
    </div>
  );
}

function ConnectionStatus({ connected, duration }: {
  connected: boolean;
  duration: string;
}) {
  return (
    <div
      className="flex items-center text-[11px]"
      style={{ gap: 6, color: 'var(--text-secondary)' }}
    >
      <div
        className="rounded-full"
        style={{
          width: 6,
          height: 6,
          background: connected ? 'var(--accent-green)' : 'var(--text-secondary)',
        }}
      />
      <span>{connected ? '已连接' : '未连接'} · {duration}</span>
    </div>
  );
}
