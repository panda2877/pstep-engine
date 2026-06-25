/**
 * MessageArea 组件
 * 消息区域：消息列表、输入框
 */

import { useState } from 'react';
import { SearchModal } from './SearchModal';

interface MessageAreaProps {
  selectedAgent: string;
  selectedSession: string;
  onToggleHelper: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  time: string;
}

// 临时使用静态数据
const MOCK_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'agent',
    content: '你好！我是紫灵 😏\n\n有什么想法想跟我聊聊的吗？我可以帮你：\n• 挖掘需求细节\n• 讨论技术方案\n• 输出需求文档',
    time: '14:23:15',
  },
  {
    id: '2',
    role: 'user',
    content: '我想做一个跨端Agent连接工具，帮我分析一下可行性？',
    time: '14:23:30',
  },
  {
    id: '3',
    role: 'agent',
    content: '好问题！我先看看你的服务器资源情况……\n\n发现一个好消息——api_server 已经在端口 8642 上运行了 🎉\n\n$ curl http://127.0.0.1:8642/health\n{"status": "ok", "platform": "hermes-agent"}\n\n这意味着你不需要任何后端开发，前端直接调就行！',
    time: '14:23:45',
  },
];

export function MessageArea({
  selectedAgent,
  selectedSession,
  onToggleHelper,
}: MessageAreaProps) {
  const [messages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    // TODO: 发送消息
    console.log('Sending:', inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      handleSend();
    }
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

          {/* Memory Badge */}
          <button
            className="flex items-center rounded-xl cursor-pointer transition-all"
            style={{
              fontSize: 10,
              padding: '3px 8px',
              gap: 4,
              color: 'var(--accent-green)',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid transparent',
            }}
            title="点击查看记忆详情"
          >
            <svg style={{ width: 12, height: 12 }} viewBox="0 0 24 24">
              <path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.4 6.5 6 8.5V22h6v-2.5c3.6-2 6-4.9 6-8.5a9 9 0 0 0-9-9z" />
              <path d="M12 2v4" />
            </svg>
            记忆已加载
          </button>
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
        {/* Date Separator */}
        <div
          className="text-center relative"
          style={{ color: 'var(--text-secondary)', fontSize: 10, padding: '8px 0' }}
        >
          <span
            className="absolute left-0 top-1/2 h-px"
            style={{
              width: 'calc(50% - 50px)',
              background: 'var(--border-card)',
            }}
          />
          <span>今天</span>
          <span
            className="absolute right-0 top-1/2 h-px"
            style={{
              width: 'calc(50% - 50px)',
              background: 'var(--border-card)',
            }}
          />
        </div>

        {/* Messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="flex"
            style={{
              gap: 10,
              maxWidth: '75%',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              className="rounded-lg break-words"
              style={{
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.6,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                borderBottomLeftRadius: msg.role === 'agent' ? 4 : undefined,
                borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
              }}
            >
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
            <div
              className={`flex-shrink-0 ${msg.role === 'user' ? 'text-right' : ''}`}
              style={{ fontSize: 9, color: 'var(--text-secondary)', padding: '2px 4px 0' }}
            >
              {msg.time}
            </div>
          </div>
        ))}
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
            {/* Attachment Button */}
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
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </span>
              <span>附件</span>
            </button>

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
              placeholder="输入消息..."
              rows={1}
              className="w-full resize-none outline-none"
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
              }}
            />
          </div>
          {/* Send Button */}
          <button
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent-gold)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={handleSend}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" style={{ width: 16, height: 16 }}>
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
