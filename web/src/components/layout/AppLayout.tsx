/**
 * App 主布局组件
 * 实现原型图的整体布局结构
 */

import { useAppStore } from '../../stores/appStore';
import { Topbar } from './Topbar';
import { FnBar } from './FnBar';
import { AgentBar } from './AgentBar';
import { MessageArea } from './MessageArea';
import { HelperPanel } from './HelperPanel';

export function AppLayout() {
  const { state, dispatch, selectAgent, selectSession } = useAppStore();

  const handleAgentSelect = (agentName: string) => {
    // 通过名称查找 agent ID
    const agent = state.agents.find(a => a.name === agentName);
    if (agent) {
      selectAgent(agent.id);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    selectSession(sessionId);
    if (state.mobileView !== 'chat') {
      dispatch({ type: 'SET_MOBILE_VIEW', payload: 'chat' });
    }
  };

  const handleToggleHelper = () => {
    if (!state.helperOpen) {
      dispatch({ type: 'SET_HELPER_OPEN', payload: true });
      dispatch({ type: 'SET_MOBILE_VIEW', payload: 'helper' });
    } else {
      dispatch({ type: 'SET_HELPER_OPEN', payload: false });
      dispatch({ type: 'SET_MOBILE_VIEW', payload: 'chat' });
    }
  };

  const selectedAgent = state.agents.find(a => a.id === state.selectedAgentId);
  const selectedSession = state.sessions.find(s => s.id === state.selectedSessionId);

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Topbar */}
      <Topbar />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fn Bar - 桌面端显示 */}
        <div className="hidden md:block flex-shrink-0">
          <FnBar
            activeView={state.activeView}
            onViewChange={(view) => dispatch({ type: 'SET_ACTIVE_VIEW', payload: view })}
          />
        </div>

        {/* Agent Bar - 桌面端始终显示；移动端仅 agents 视图 */}
        <div className={`${
          state.mobileView === 'agents' ? 'flex' : 'hidden'
        } md:flex flex-shrink-0`}>
          <AgentBar
            selectedAgent={selectedAgent?.name || ''}
            selectedSession={selectedSession?.id || ''}
            onAgentSelect={handleAgentSelect}
            onSessionSelect={handleSessionSelect}
          />
        </div>

        {/* Message Area - 桌面端始终显示；移动端仅 chat 视图 */}
        <div className={`${
          state.mobileView === 'chat' ? 'flex' : 'hidden'
        } md:flex flex-1 min-w-0`}>
          <MessageArea
            selectedAgent={selectedAgent?.name || ''}
            selectedSession={selectedSession?.title || selectedSession?.id || ''}
            agentId={selectedAgent?.id}
            sessionId={selectedSession?.id}
            projectId={state.selectedProjectId || state.projects[0]?.id}
            onToggleHelper={handleToggleHelper}
            onBack={() => dispatch({ type: 'SET_MOBILE_VIEW', payload: 'agents' })}
            onSelectSession={handleSessionSelect}
          />
        </div>

        {/* Helper Panel */}
        <HelperPanel
          isOpen={state.helperOpen}
          onClose={() => dispatch({ type: 'SET_HELPER_OPEN', payload: false })}
          isMobile={state.mobileView === 'helper'}
          onMobileOverlayClose={() => dispatch({ type: 'SET_MOBILE_VIEW', payload: 'chat' })}
        />
      </div>
    </div>
  );
}
