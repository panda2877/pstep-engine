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

export function AppLayout() {
  const [activeView, setActiveView] = useState<'chat' | 'setting'>('chat');
  const [selectedAgent, setSelectedAgent] = useState<string>('紫灵');
  const [selectedSession, setSelectedSession] = useState<string>('当前会话');
  const [helperOpen, setHelperOpen] = useState(true);
  const [mobileView, setMobileView] = useState<'agents' | 'chat' | 'helper'>('chat');

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Topbar */}
      <Topbar />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fn Bar - 桌面端显示 */}
        <div className="hidden md:block flex-shrink-0">
          <FnBar
            activeView={activeView}
            onViewChange={setActiveView}
          />
        </div>

        {/* Agent Bar - 桌面端始终显示；移动端仅 agents 视图 */}
        <div className={`${
          mobileView === 'agents' ? 'flex' : 'hidden'
        } md:flex flex-shrink-0`}>
          <AgentBar
            selectedAgent={selectedAgent}
            selectedSession={selectedSession}
            onAgentSelect={setSelectedAgent}
            onSessionSelect={(s) => {
              setSelectedSession(s);
              if (mobileView !== 'chat') setMobileView('chat');
            }}
          />
        </div>

        {/* Message Area - 桌面端始终显示；移动端仅 chat 视图 */}
        <div className={`${
          mobileView === 'chat' ? 'flex' : 'hidden'
        } md:flex flex-1 min-w-0`}>
          <MessageArea
            selectedAgent={selectedAgent}
            selectedSession={selectedSession}
            onToggleHelper={() => {
              if (!helperOpen) {
                // 打开：桌面端 toggle，移动端切到 helper 视图
                setHelperOpen(true);
                setMobileView('helper');
              } else {
                // 关闭
                setHelperOpen(false);
                setMobileView('chat');
              }
            }}
            onBack={() => setMobileView('agents')}
          />
        </div>

        {/* Helper Panel */}
        <HelperPanel
          isOpen={helperOpen}
          onClose={() => setHelperOpen(false)}
          isMobile={mobileView === 'helper'}
          onMobileOverlayClose={() => setMobileView('chat')}
        />
      </div>
    </div>
  );
}
