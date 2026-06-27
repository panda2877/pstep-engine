/**
 * SearchModal 组件
 * 搜索弹窗：搜索会话内容，高亮匹配关键词
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { messageApi } from '../../services/api';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

interface SearchResult {
  id: string;
  sessionId: string;
  content: string;
  role: string;
  createdAt: number;
}

export function SearchModal({ isOpen, onClose, projectId }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await messageApi.search({ q: q.trim(), projectId });
      setResults(res.results || []);
    } catch (err) {
      console.error('[Search] API error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  if (!isOpen) return null;

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

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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
            placeholder="搜索所有会话内容..."
            className="flex-1 border-none outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
          {loading && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>搜索中...</span>
          )}
        </div>

        {/* Search Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {!hasQuery && (
            <div
              className="text-center"
              style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 12 }}
            >
              输入关键词搜索所有会话内容
            </div>
          )}

          {hasQuery && !loading && results.length === 0 && (
            <div
              className="text-center"
              style={{ padding: 32, color: 'var(--text-secondary)', fontSize: 12 }}
            >
              未找到匹配内容
            </div>
          )}

          {results.map((item, index) => (
            <div
              key={item.id}
              className="cursor-pointer transition-colors"
              style={{
                padding: '10px 14px',
                borderBottom: index < results.length - 1 ? '1px solid var(--border-card)' : 'none',
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
                {highlightText(item.content.length > 200 ? item.content.slice(0, 200) + '...' : item.content, query)}
              </div>
              <div
                style={{ fontSize: 10, marginTop: 4, color: 'var(--text-secondary)' }}
              >
                {item.role === 'user' ? '👤' : '🤖'} {formatTime(item.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
