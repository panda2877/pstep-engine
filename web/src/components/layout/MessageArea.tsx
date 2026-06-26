/**
 * MessageArea 组件
 * 消息区域：消息列表、输入框、流式输出
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { SearchModal } from './SearchModal';
import { useAppStore } from '../../stores/appStore';
import { sessionApi, createChatStream, type Message, type SSEMessage } from '../../services/api';

interface MessageAreaProps {
  selectedAgent: string;
  selectedSession: string;
  agentId?: string;
  sessionId?: string;
  projectId?: string;
  onToggleHelper: () => void;
  onBack?: () => void;
}

export function MessageArea({
  selectedAgent,
  selectedSession,
  agentId,
  sessionId,
  projectId,
  onToggleHelper,
  onBack,
}: MessageAreaProps) {
  const { state, fetchSessions } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // 加载会话消息
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    sessionApi.messages(sessionId)
      .then((res) => setMessages(res.messages || []))
      .catch((err) => console.error('[MessageArea] Failed to load messages:', err))
      .finally(() => setLoadingMessages(false));
  }, [sessionId]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !projectId) return;
    if (isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue('');

    // 添加用户消息
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      sessionId: sessionId || '',
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // 开始流式输出
    setIsStreaming(true);
    setStreamingContent('');

    let accumulatedContent = '';
    let currentSessionId = sessionId;

    abortRef.current = createChatStream(
      {
        projectId,
        agentId,
        sessionId,
        message: userMessage,
      },
      // onMessage
      (msg: SSEMessage) => {
        if (msg.type === 'content' && msg.content) {
          accumulatedContent += msg.content;
          setStreamingContent(accumulatedContent);
        } else if (msg.type === 'plan' && msg.content) {
          setStreamingContent(`🔄 ${msg.content}\n\n`);
        } else if (msg.type === 'step') {
          const statusIcon = msg.status === 'completed' ? '✅' : msg.status === 'failed' ? '❌' : '⏳';
          setStreamingContent((prev) => `${prev}\n${statusIcon} ${msg.stepName || `步骤 ${msg.stepIndex}`}\n`);
        } else if (msg.type === 'done') {
          currentSessionId = msg.sessionId || currentSessionId;
        }
      },
      // onDone
      () => {
        setIsStreaming(false);
        setStreamingContent('');

        // 添加 assistant 消息
        if (accumulatedContent) {
          const assistantMsg: Message = {
            id: `temp-${Date.now()}`,
            sessionId: currentSessionId || sessionId || '',
            role: 'assistant',
            content: accumulatedContent,
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
        }

        // 如果是新会话，刷新会话列表
        if (!sessionId && currentSessionId && state.selectedAgentId) {
          fetchSessions(state.selectedAgentId);
        }
      },
      // onError
      (err) => {
        console.error('[MessageArea] Stream error:', err);
        setIsStreaming(false);
        setStreamingContent('');
      },
    );
  }, [inputValue, projectId, agentId, sessionId, isStreaming, fetchSessions, state.selectedAgentId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.();
    setIsStreaming(false);
    setStreamingContent('');
  };

  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg-primary)' }}>
      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Message Header */}
      <div
        className="flex items-center justify-between flex-shrink-0"
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-card)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          {/* Back Button (Mobile) */}
          <button
            className="md:hidden flex items-center justify-center"
            onClick={onBack}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Current Agent */}
          <div className="flex items-center" style={{ gap: 8 }}>
            <div
              className="flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--bg-card)',
              }}
            >
              <span className="font-semibold" style={{ fontSize: 10 }}>
                {selectedAgent.charAt(0)}
              </span>
            </div>
            <span className="font-medium" style={{ fontSize: 13 }}>{selectedAgent}</span>
          </div>

          {/* Current Session */}
          <span
            className="rounded-xl"
            style={{
              fontSize: 11,
              padding: '3px 8px',
              color: 'var(--text-secondary)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
            }}
          >
            {selectedSession}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center" style={{ gap: 4 }}>
          <button
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="搜索会话"
            onClick={() => setSearchOpen(true)}
          >
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
          <button
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-btn)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="展开辅助面板"
            onClick={onToggleHelper}
          >
            <svg className="icon" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto flex flex-col" style={{ padding: '16px 20px', gap: 12 }}>
        {loadingMessages ? (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            加载消息...
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: 'var(--text-secondary)', fontSize: 12, gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 40, height: 40, opacity: 0.3 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>开始新的对话</span>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex"
                style={{
                  gap: 10,
                  maxWidth: '85%',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.role !== 'user' && (
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'var(--bg-card)',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                      {selectedAgent.charAt(0)}
                    </span>
                  </div>
                )}
                <div
                  className="rounded-lg break-words"
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: msg.role === 'user' ? 'var(--accent-gold)' : 'var(--bg-card)',
                    color: msg.role === 'user' ? '#1a1a1a' : 'var(--text-primary)',
                    borderBottomLeftRadius: msg.role !== 'user' ? 4 : undefined,
                    borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                  }}
                >
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
              </div>
            ))}

            {/* 流式输出中 */}
            {isStreaming && (
              <div className="flex" style={{ gap: 10, maxWidth: '85%', alignSelf: 'flex-start' }}>
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {selectedAgent.charAt(0)}
                  </span>
                </div>
                <div
                  className="rounded-lg break-words"
                  style={{
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    borderBottomLeftRadius: 4,
                    minHeight: 40,
                  }}
                >
                  {streamingContent ? (
                    <pre className="whitespace-pre-wrap font-sans">{streamingContent}</pre>
                  ) : (
                    <div className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <span className="animate-pulse">●</span>
                      <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                      <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div
        className="flex-shrink-0"
        style={{
          padding: '10px 12px 12px',
          borderTop: '1px solid var(--border-card)',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div className="flex items-center" style={{ gap: 6 }}>
            {/* New Session Button */}
            <button
              className="flex items-center cursor-pointer transition-all"
              style={{
                gap: 4,
                padding: '4px 8px 4px 4px',
                borderRadius: 8,
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: 11,
              }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  background: 'rgba(212, 168, 83, 0.15)',
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              <span>新建</span>
            </button>
          </div>
        </div>

        {/* Input */}
        <div className="flex items-end" style={{ gap: 8 }}>
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Ctrl+Enter 发送)"
              rows={1}
              className="w-full resize-none outline-none"
              disabled={isStreaming}
              style={{
                minHeight: 44,
                maxHeight: 120,
                padding: '12px 14px',
                borderRadius: 14,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontFamily: 'inherit',
                lineHeight: 1.5,
                opacity: isStreaming ? 0.6 : 1,
              }}
            />
          </div>
          {/* Send / Stop Button */}
          {isStreaming ? (
            <button
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: '#ef4444',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onClick={handleStop}
              title="停止生成"
            >
              <svg viewBox="0 0 24 24" fill="white" style={{ width: 14, height: 14 }}>
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: 'none',
                background: inputValue.trim() ? 'var(--accent-gold)' : 'var(--bg-card)',
                cursor: inputValue.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s',
                opacity: inputValue.trim() ? 1 : 0.5,
              }}
              onClick={handleSend}
              disabled={!inputValue.trim() || !projectId}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={inputValue.trim() ? '#1a1a1a' : 'var(--text-secondary)'} strokeWidth="2" style={{ width: 16, height: 16 }}>
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
