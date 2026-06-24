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
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{
          height: 48,
          borderBottom: '1px solid var(--border-main)',
          background: 'var(--bg-primary)',
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
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-card)' }}
            >
              <span className="text-[14px] font-semibold">
                {selectedAgent.charAt(0)}
              </span>
            </div>
            <span className="text-[14px] font-semibold">{selectedAgent}</span>
          </div>

          {/* Current Session */}
          <span
            className="text-[12px] px-2 py-0.5 rounded-xl"
            style={{
              color: 'var(--text-muted)',
            }}
          >
            {selectedSession}
          </span>

          {/* Memory Badge */}
          <button
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-xl cursor-pointer transition-all"
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
              width: 32,
              height: 32,
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
              width: 32,
              height: 32,
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
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {/* Date Separator */}
        <div
          className="text-center text-[11px] py-2 relative"
          style={{ color: 'var(--text-muted)' }}
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
            className={`flex flex-col gap-1 max-w-[75%] ${
              msg.role === 'user' ? 'self-end items-end ml-auto' : 'self-start items-start'
            }`}
          >
            <div
              className="px-3.5 py-2.5 rounded-lg text-[14px] leading-relaxed break-words"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-main)',
                color: 'var(--text-primary)',
                borderRadius: msg.role === 'agent'
                  ? '4px var(--radius-lg) var(--radius-lg) var(--radius-lg)'
                  : 'var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)',
              }}
            >
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
            <div
              className={`text-[11px] px-1 ${
                msg.role === 'user' ? 'text-right' : ''
              }`}
              style={{ color: 'var(--text-muted)' }}
            >
              {msg.time}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div
        className="px-5 pb-4 pt-3 flex-shrink-0"
        style={{
          borderTop: '1px solid var(--border-main)',
          background: 'var(--bg-primary)',
        }}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {/* Attachment Button */}
            <button
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-[12px]"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <span>附件</span>
            </button>

            {/* New Session Button */}
            <button
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-[12px]"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 14, height: 14 }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>新建</span>
            </button>
          </div>
        </div>

        {/* Input */}
        <div
          className="flex gap-2 items-end"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-main)',
            borderRadius: 'var(--radius-lg)',
            padding: '8px 12px',
          }}
        >
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            rows={1}
            className="flex-1 resize-none outline-none border-none"
            style={{
              minHeight: 22,
              maxHeight: 120,
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          />
          {/* Send Button */}
          <button
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-gold)',
              color: 'var(--bg-deep)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={handleSend}
          >
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
