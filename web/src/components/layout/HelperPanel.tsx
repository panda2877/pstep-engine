/**
 * 右侧辅助面板组件
 * 三个 Tab：User Memory / Soul / Project Memory
 * 对接真实 API，支持增删改
 */

import { useState, useEffect, useCallback } from 'react';
import { memoryApi, agentApi, type MemoryEntry, type Agent, type AgentSoul } from '../../services/api';
import { useAppStore } from '../../stores/appStore';

interface HelperPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile?: boolean;
  onMobileOverlayClose?: () => void;
}

// ============================================================================
// Memory categories by group
// ============================================================================

const USER_CATEGORIES = [
  { key: 'user_identity', label: '身份' },
  { key: 'user_preference', label: '偏好' },
  { key: 'user_style', label: '风格' },
] as const;

const PROJECT_CATEGORIES = [
  { key: 'project_decision', label: '决策' },
  { key: 'project_context', label: '上下文' },
] as const;

// ============================================================================
// Main Component
// ============================================================================

export function HelperPanel({ isOpen, onClose, isMobile, onMobileOverlayClose }: HelperPanelProps) {
  const [activeTab, setActiveTab] = useState<'user' | 'soul' | 'memory'>('user');

  const tabTitles = {
    user: 'User Memory',
    soul: 'Soul',
    memory: 'Project Memory',
  };

  // Mobile overlay
  if (isMobile) {
    return (
      <>
        <div
          onClick={() => { onClose(); onMobileOverlayClose?.(); }}
          style={{
            position: 'fixed', inset: 0,
            background: isOpen ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
            zIndex: 1000, opacity: isOpen ? 1 : 0,
            pointerEvents: isOpen ? 'auto' : 'none',
            transition: 'opacity 0.5s ease, background 0.5s ease',
          }}
        />
        <div
          style={{
            position: 'fixed', top: 0, right: 0, bottom: 0,
            width: '66.67%', maxWidth: 'none', zIndex: 1001,
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.5s ease',
            boxShadow: isOpen ? '-10px 0 30px var(--shadow)' : 'none',
            background: 'var(--bg-secondary)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <PanelContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabTitles={tabTitles}
            onClose={() => { onClose(); onMobileOverlayClose?.(); }}
          />
        </div>
      </>
    );
  }

  // Desktop
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

// ============================================================================
// Panel Content
// ============================================================================

function PanelContent({
  activeTab, setActiveTab, tabTitles, onClose,
}: {
  activeTab: 'user' | 'soul' | 'memory';
  setActiveTab: (tab: 'user' | 'soul' | 'memory') => void;
  tabTitles: Record<string, string>;
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border-card)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
          {tabTitles[activeTab]}
        </span>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: 'var(--radius-sm)',
          border: 'none', background: 'transparent',
          color: 'var(--text-secondary)', cursor: 'pointer',
        }}>
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
              padding: '8px 12px', fontSize: 11,
              color: activeTab === tab ? 'var(--accent-gold)' : 'var(--text-secondary)',
              background: 'transparent', border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent-gold)' : '2px solid transparent',
              cursor: 'pointer', transition: 'color 0.2s, border-color 0.2s',
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
        {activeTab === 'memory' && <ProjectMemorySection />}
      </div>
    </>
  );
}

// ============================================================================
// User Memory Section
// ============================================================================

function UserSection() {
  const { state } = useAppStore();
  const projectId = state.selectedProjectId;
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [newItem, setNewItem] = useState<{ category: string; summary: string } | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!projectId) return;
    try {
      const all: MemoryEntry[] = [];
      for (const cat of USER_CATEGORIES) {
        const { memories: m } = await memoryApi.list({ projectId, category: cat.key });
        all.push(...m);
      }
      setMemories(all);
    } catch (err) {
      console.error('[HelperPanel] Failed to fetch user memories:', err);
    }
  }, [projectId]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const handleSave = async () => {
    if (!projectId || !newItem || !newItem.summary.trim()) return;
    try {
      await memoryApi.create({ projectId, category: newItem.category, summary: newItem.summary.trim() });
      setNewItem(null);
      fetchMemories();
    } catch (err) {
      console.error('[HelperPanel] Failed to create memory:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await memoryApi.delete(id);
      fetchMemories();
    } catch (err) {
      console.error('[HelperPanel] Failed to delete memory:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {USER_CATEGORIES.map((cat) => {
        const items = memories.filter((m) => m.category === cat.key);
        return (
          <div key={cat.key}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {cat.label}
            </div>
            {items.length === 0 && !newItem && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 0' }}>暂无</div>
            )}
            {items.map((m) => (
              <MemoryItem
                key={m.id}
                content={m.summary}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
          </div>
        );
      })}

      {/* Add new */}
      {newItem ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            style={{
              padding: '6px 8px', fontSize: 11, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-card)', background: 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
          >
            {USER_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          <textarea
            value={newItem.summary}
            onChange={(e) => setNewItem({ ...newItem, summary: e.target.value })}
            placeholder="输入记忆内容..."
            rows={2}
            style={{
              padding: '6px 8px', fontSize: 11, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-card)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} style={saveBtnStyle}>保存</button>
            <button onClick={() => setNewItem(null)} style={cancelBtnStyle}>取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setNewItem({ category: 'user_preference', summary: '' })} style={addBtnStyle}>
          + 添加用户记忆
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Soul Section
// ============================================================================

function SoulSection() {
  const { state } = useAppStore();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [soul, setSoul] = useState<AgentSoul>({ role: '', personality: '', responsibilities: '', catchphrase: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state.selectedAgentId) return;
    setLoading(true);
    agentApi.get(state.selectedAgentId)
      .then((data) => {
        setAgent(data);
        setSoul(data.soul || { role: '', personality: '', responsibilities: '', catchphrase: '' });
      })
      .catch((err) => console.error('[HelperPanel] Failed to load agent:', err))
      .finally(() => setLoading(false));
  }, [state.selectedAgentId]);

  const handleSave = async () => {
    if (!agent) return;
    try {
      await agentApi.update(agent.id, { soul });
      setEditing(false);
    } catch (err) {
      console.error('[HelperPanel] Failed to update soul:', err);
    }
  };

  if (!state.selectedAgentId) {
    return <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '10px 0' }}>请先选择一个 Agent</div>;
  }

  if (loading) {
    return <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '10px 0' }}>加载中...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
        {agent?.name || 'Agent'}
      </div>

      {[
        { key: 'role' as const, label: '角色', value: soul.role },
        { key: 'personality' as const, label: '性格', value: soul.personality },
        { key: 'responsibilities' as const, label: '职责', value: soul.responsibilities },
        { key: 'catchphrase' as const, label: '口头禅', value: soul.catchphrase || '' },
      ].map((field) => (
        <div key={field.key}>
          <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {field.label}
          </div>
          {editing ? (
            <textarea
              value={field.value}
              onChange={(e) => setSoul({ ...soul, [field.key]: e.target.value })}
              rows={2}
              style={{
                width: '100%', padding: '6px 8px', fontSize: 11,
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-card)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', resize: 'vertical',
              }}
            />
          ) : (
            <div style={{
              padding: '8px 10px', fontSize: 11, color: 'var(--text-primary)',
              background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-card)', lineHeight: 1.5,
            }}>
              {field.value || '未设置'}
            </div>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 6 }}>
        {editing ? (
          <>
            <button onClick={handleSave} style={saveBtnStyle}>保存</button>
            <button onClick={() => setEditing(false)} style={cancelBtnStyle}>取消</button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} style={addBtnStyle}>编辑 Soul</button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Project Memory Section
// ============================================================================

function ProjectMemorySection() {
  const { state } = useAppStore();
  const projectId = state.selectedProjectId;
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [newItem, setNewItem] = useState<{ category: string; summary: string } | null>(null);

  const fetchMemories = useCallback(async () => {
    if (!projectId) return;
    try {
      const all: MemoryEntry[] = [];
      for (const cat of PROJECT_CATEGORIES) {
        const { memories: m } = await memoryApi.list({ projectId, category: cat.key });
        all.push(...m);
      }
      setMemories(all);
    } catch (err) {
      console.error('[HelperPanel] Failed to fetch project memories:', err);
    }
  }, [projectId]);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const handleSave = async () => {
    if (!projectId || !newItem || !newItem.summary.trim()) return;
    try {
      await memoryApi.create({ projectId, category: newItem.category, summary: newItem.summary.trim() });
      setNewItem(null);
      fetchMemories();
    } catch (err) {
      console.error('[HelperPanel] Failed to create memory:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await memoryApi.delete(id);
      fetchMemories();
    } catch (err) {
      console.error('[HelperPanel] Failed to delete memory:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {PROJECT_CATEGORIES.map((cat) => {
        const items = memories.filter((m) => m.category === cat.key);
        return (
          <div key={cat.key}>
            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {cat.label}
            </div>
            {items.length === 0 && !newItem && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 0' }}>暂无</div>
            )}
            {items.map((m) => (
              <MemoryItem
                key={m.id}
                content={m.summary}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
          </div>
        );
      })}

      {/* Add new */}
      {newItem ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <select
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
            style={{
              padding: '6px 8px', fontSize: 11, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-card)', background: 'var(--bg-card)',
              color: 'var(--text-primary)',
            }}
          >
            {PROJECT_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          <textarea
            value={newItem.summary}
            onChange={(e) => setNewItem({ ...newItem, summary: e.target.value })}
            placeholder="输入记忆内容..."
            rows={2}
            style={{
              padding: '6px 8px', fontSize: 11, borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-card)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} style={saveBtnStyle}>保存</button>
            <button onClick={() => setNewItem(null)} style={cancelBtnStyle}>取消</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setNewItem({ category: 'project_context', summary: '' })} style={addBtnStyle}>
          + 添加项目记忆
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

function MemoryItem({ content, onDelete }: { content: string; onDelete?: () => void }) {
  return (
    <div
      style={{
        padding: '8px 10px', marginBottom: 4,
        background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-card)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
        {content}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--text-tertiary)', fontSize: 12, padding: 0,
            lineHeight: 1, flexShrink: 0,
          }}
          title="删除"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Shared Styles
// ============================================================================

const addBtnStyle: React.CSSProperties = {
  padding: '8px 12px', fontSize: 11,
  color: 'var(--accent-gold)', background: 'transparent',
  border: '1px dashed var(--accent-gold)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', textAlign: 'center',
};

const saveBtnStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11,
  color: '#fff', background: 'var(--accent-gold)',
  border: 'none', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer', flex: 1,
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 12px', fontSize: 11,
  color: 'var(--text-secondary)', background: 'transparent',
  border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};
