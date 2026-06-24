/**
 * App 主布局组件
 * 实现原型图的整体布局结构
 */

import { useState } from 'react';
import { Topbar } from './Topbar';
import { FnBar } from './FnBar';
import { AgentBar } from './AgentBar';
import { MessageArea } from './MessageArea';
import { HelperPanel } from './HelperPanel';
import { MobileNav } from './MobileNav';

export function AppLayout() {
  const [activeView, setActiveView] = useState<'chat' | 'setting'>('chat');
  const [selectedAgent, setSelectedAgent] = useState<string>('紫灵');
  const [selectedSession, setSelectedSession] = useState<string>('当前会话');
  const [helperOpen, setHelperOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'agents' | 'chat' | 'helper'>('chat');

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Topbar */}
      <Topbar
        selectedAgent={selectedAgent}
        selectedSession={selectedSession}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fn Bar - 桌面端显示 */}
        <div className="hidden md:block">
          <FnBar
            activeView={activeView}
            onViewChange={setActiveView}
          />
        </div>

        {/* Agent Bar - 桌面端或移动端 agents 视图 */}
        <div className={`${
          mobileView === 'agents' ? 'flex' : 'hidden'
        } md:flex`}>
          <AgentBar
            selectedAgent={selectedAgent}
            selectedSession={selectedSession}
            onAgentSelect={setSelectedAgent}
            onSessionSelect={setSelectedSession}
          />
        </div>

        {/* Message Area - 桌面端或移动端 chat 视图 */}
        <div className={`${
          mobileView === 'chat' ? 'flex' : 'hidden'
        } md:flex flex-1 min-w-0`}>
          <MessageArea
            selectedAgent={selectedAgent}
            selectedSession={selectedSession}
            onToggleHelper={() => setHelperOpen(!helperOpen)}
          />
        </div>

        {/* Helper Panel */}
        <HelperPanel
          isOpen={helperOpen}
          onClose={() => setHelperOpen(false)}
          isMobile={mobileView === 'helper'}
        />
      </div>

      {/* Mobile Navigation */}
      <MobileNav
        activeView={mobileView}
        onViewChange={setMobileView}
      />
    </div>
  );
}
