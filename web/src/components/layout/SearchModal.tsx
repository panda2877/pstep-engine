/**
 * SearchModal 组件
 * 搜索弹窗：搜索会话内容，高亮匹配关键词
 */

import { useState, useRef, useEffect } from 'react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  text: string;
  time: string;
}

const MOCK_MESSAGES: SearchResult[] = [
  { text: '我想做一个跨端Agent连接工具，帮我分析一下可行性？', time: '今天 14:23:30' },
  { text: '发现一个好消息——api_server 已经在端口 8642 上运行了', time: '今天 14:23:45' },
  { text: '你好！我是紫灵 😏', time: '今天 14:23:15' },
];

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // 延迟聚焦，等 transition 结束
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ESC 关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = query.trim()
    ? MOCK_MESSAGES.filter((m) =>
        m.text.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const hasQuery = query.trim().length > 0;

  const highlightText = (text: string, keyword: string) => {
    if (!keyword.trim()) return text;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i}>{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      className="fixed inset-0 flex items-start justify-center"
      style={{
        background: 'rgba(0,0,0,0.6)',
        paddingTop: 80,
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="overflow-hidden"
        style={{
          width: 480,
          maxWidth: '90vw',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-card)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
      >
        {/* Search Input */}
        <div
          className="flex items-center"
          style={{
            gap: 10,
            padding: '12px 14px',
            borderBottom: '1px solid var(--border-card)',
          }}
        >
          <svg className="icon" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)', width: 18, height: 18 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索当前会话内容..."
            className="flex-1 border-none outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
        </div>

        {/* Search Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {!hasQuery && (
            <div
              className="text-center"
              style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 12 }}
            >
              输入关键词搜索会话内容
            </div>
          )}

          {hasQuery && filtered.length === 0 && (
            <div
              className="text-center"
              style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 12 }}
            >
              未找到匹配内容
            </div>
          )}

          {filtered.map((item, index) => (
            <div
              key={index}
              className="cursor-pointer transition-colors"
              style={{
                padding: '10px 14px',
                borderBottom: index < filtered.length - 1 ? '1px solid var(--border-card)' : 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                }}
              >
                {highlightText(item.text, query)}
              </div>
              <div
                style={{ fontSize: 10, marginTop: 4, color: 'var(--text-secondary)' }}
              >
                {item.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
