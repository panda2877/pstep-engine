/**
 * 右侧辅助面板组件
 * 桌面端：侧边栏 width 过渡动画
 * 移动端：右侧滑入 overlay（匹配原型图）
 */

import { useState } from 'react';

interface HelperPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  /** 移动端：点击遮罩关闭后切回 chat 视图 */
  onMobileOverlayClose?: () => void;
}

export function HelperPanel({ isOpen, onClose, isMobile, onMobileOverlayClose }: HelperPanelProps) {
  const [activeTab, setActiveTab] = useState<'user' | 'soul' | 'memory'>('user');

  const tabTitles = {
    user: 'User Memory',
    soul: 'Soul',
    memory: 'LanceDB Memory',
  };

  // 移动端：始终渲染，用 CSS transform 控制滑入动画
  if (isMobile) {
    return (
      <>
        {/* 遮罩层 */}
        <div
          onClick={() => {
            onClose();
            onMobileOverlayClose?.();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: isOpen ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
            zIndex: 1000,
            opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
            transition: 'opacity 0.5s ease, background 0.5s ease',
          }}
        />
        {/* 辅助面板 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '66.67%',
            maxWidth: 'none',
            zIndex: 1001,
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.5s ease',
            boxShadow: isOpen ? '-10px 0 30px var(--shadow)' : 'none',
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <PanelContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabTitles={tabTitles}
            onClose={() => {
              onClose();
              onMobileOverlayClose?.();
            }}
          />
        </div>
      </>
    );
  }

  // 桌面端：始终渲染，用 width 过渡动画
  return (
    <div
      className="hidden md:flex flex-col flex-shrink-0 overflow-hidden"
      style={{
        width: isOpen ? 'var(--panel-width)' : 0,
        minWidth: isOpen ? 'var(--panel-width)' : 0,
        maxWidth: isOpen ? 'var(--panel-width)' : 0,
        borderLeft: isOpen ? '1px solid var(--border-card)' : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      {isOpen && (
        <PanelContent
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabTitles={tabTitles}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function PanelContent({
  activeTab,
  setActiveTab,
  tabTitles,
  onClose,
}: {
  activeTab: 'user' | 'soul' | 'memory';
  setActiveTab: (tab: 'user' | 'soul' | 'memory') => void;
  tabTitles: Record<string, string>;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border-card)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
          {tabTitles[activeTab]}
        </span>
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-card)', padding: '0 8px' }}>
        {(['user', 'soul', 'memory'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 12px',
              fontSize: 11,
              color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-gold)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {activeTab === 'user' && <UserSection />}
        {activeTab === 'soul' && <SoulSection />}
        {activeTab === 'memory' && <MemorySection />}
      </div>
    </>
  );
}

function UserSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <MemoryItem title="身份" content="高级全栈工程师" />
      <MemoryItem title="偏好" content="深色主题、简洁设计、中文交流" />
      <MemoryItem title="风格" content="直接高效，注重代码质量" />
    </div>
  );
}

function SoulSection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <MemoryItem title="核心" content="Plan → Solve → Verify 循环验证" />
      <MemoryItem title="原则" content="先规划后执行，每步验证" />
      <MemoryItem title="目标" content="高质量、可维护的解决方案" />
    </div>
  );
}

function MemorySection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <MemoryItem title="项目" content="pstep-engine AI Agent 引擎" />
      <MemoryItem title="技术栈" content="TypeScript, Fastify, SQLite" />
      <MemoryItem title="进度" content="Phase 1: Web UI 基础框架" />
    </div>
  );
}

function MemoryItem({ title, content }: { title: string; content: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-card)',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {content}
      </div>
    </div>
  );
}
