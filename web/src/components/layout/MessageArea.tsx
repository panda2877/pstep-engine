/**
 * MessageArea 组件
 * 消息区域：消息列表、输入框
 */

import { useState } from 'react';

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

  return (
    <div className="flex flex-col flex-1 min-w-0" style={{ background: 'var(--bg-primary)' }}>
      {/* Message Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--border-card)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-card)' }}
            >
              <span className="text-[10px] font-semibold">
                {selectedAgent.charAt(0)}
              </span>
            </div>
            <span className="text-[13px] font-medium">{selectedAgent}</span>
          </div>

          {/* Current Session */}
          <span
            className="text-[11px] px-2 py-0.5 rounded-xl"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
            }}
          >
            {selectedSession}
          </span>

          {/* Memory Badge */}
          <button
            className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-xl cursor-pointer transition-all"
            style={{
              color: 'var(--accent-green)',
              background: 'rgba(34, 197, 94, 0.1)',
            }}
            title="点击查看记忆详情"
          >
            <svg className="icon icon-sm" viewBox="0 0 24 24">
              <path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.4 6.5 6 8.5V22h6v-2.5c3.6-2 6-4.9 6-8.5a9 9 0 0 0-9-9z" />
              <path d="M12 2v4" />
            </svg>
            记忆已加载
          </button>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
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
          >
            <svg className="icon icon-sm" viewBox="0 0 24 24">
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
            <svg className="icon icon-sm" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-3">
        {/* Date Separator */}
        <div
          className="text-center text-[10px] py-2 relative"
          style={{ color: 'var(--text-secondary)' }}
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
            className={`flex gap-2.5 max-w-[88%] ${
              msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'
            }`}
          >
            <div
              className="px-3.5 py-2.5 rounded-lg text-[13px] leading-6 break-words"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                borderRadius: msg.role === 'agent'
                  ? 'var(--radius-card) var(--radius-card) var(--radius-card) 4px'
                  : 'var(--radius-card) var(--radius-card) 4px var(--radius-card)',
              }}
            >
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
            <div
              className={`text-[9px] px-1 pt-0.5 ${
                msg.role === 'user' ? 'text-right' : ''
              }`}
              style={{ color: 'var(--text-secondary)' }}
            >
              {msg.time}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div
        className="px-3 pb-3 flex-shrink-0"
        style={{
          borderTop: '1px solid var(--border-card)',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {/* Attachment Button */}
            <button
              className="flex items-center gap-1 py-1 pl-1 pr-2 rounded-lg text-[11px]"
              style={{
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <span
                className="w-[22px] h-[22px] rounded flex items-center justify-center"
                style={{ background: 'rgba(212, 168, 83, 0.15)' }}
              >
                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>附件</span>
            </button>

            {/* New Session Button */}
            <button
              className="flex items-center gap-1 py-1 pl-1 pr-2 rounded-lg text-[11px]"
              style={{
                border: '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <span
                className="w-[22px] h-[22px] rounded flex items-center justify-center"
                style={{ background: 'rgba(212, 168, 83, 0.15)' }}
              >
                <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>新建</span>
            </button>
          </div>

          {/* Send Button */}
          <button
            className="flex items-center justify-center"
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
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end">
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
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
