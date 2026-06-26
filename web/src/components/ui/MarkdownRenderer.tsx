/**
 * MarkdownRenderer 组件
 * 渲染 LLM 输出的 Markdown 内容为富文本
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MermaidDiagram } from './MermaidDiagram';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={`markdown-body ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 代码块：深色背景 + 语法高亮
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  style={{
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(255, 255, 255, 0.08)',
                    fontSize: '0.9em',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                  {...props}
                >
                  {children}
                </code>
              );
            }

            // Mermaid 图表渲染
            if (match && match[1].toLowerCase() === 'mermaid') {
              // 安全提取文本：children 可能是字符串或字符串数组
              const code = Array.isArray(children)
                ? children.filter(c => typeof c === 'string').join('')
                : String(children ?? '');
              return <MermaidDiagram code={code.replace(/\n$/, '')} />;
            }

            return (
              <div style={{ position: 'relative', margin: '8px 0' }}>
                {match && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      padding: '2px 8px',
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.4)',
                      borderRadius: '0 6px 0 4px',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {match[1]}
                  </div>
                )}
                <pre
                  style={{
                    padding: '14px 16px',
                    borderRadius: 8,
                    background: '#0d1117',
                    overflowX: 'auto',
                    fontSize: 12,
                    lineHeight: 1.6,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  }}
                >
                  <code className={codeClassName} {...props}>
                    {children}
                  </code>
                </pre>
              </div>
            );
          },

          // 链接：新标签页打开
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}
                {...props}
              >
                {children}
              </a>
            );
          },

          // 表格
          table({ children, ...props }) {
            return (
              <div style={{ overflowX: 'auto', margin: '8px 0' }}>
                <table
                  style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                    fontSize: 13,
                  }}
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },

          th({ children, ...props }) {
            return (
              <th
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-card)',
                  background: 'rgba(255,255,255,0.04)',
                  fontWeight: 600,
                  textAlign: 'left',
                }}
                {...props}
              >
                {children}
              </th>
            );
          },

          td({ children, ...props }) {
            return (
              <td
                style={{
                  padding: '8px 12px',
                  border: '1px solid var(--border-card)',
                }}
                {...props}
              >
                {children}
              </td>
            );
          },

          // 列表
          ul({ children, ...props }) {
            return (
              <ul style={{ paddingLeft: 20, margin: '6px 0' }} {...props}>
                {children}
              </ul>
            );
          },

          ol({ children, ...props }) {
            return (
              <ol style={{ paddingLeft: 20, margin: '6px 0' }} {...props}>
                {children}
              </ol>
            );
          },

          li({ children, ...props }) {
            return (
              <li style={{ margin: '2px 0', lineHeight: 1.6 }} {...props}>
                {children}
              </li>
            );
          },

          // 引用块
          blockquote({ children, ...props }) {
            return (
              <blockquote
                style={{
                  margin: '8px 0',
                  padding: '8px 16px',
                  borderLeft: '3px solid var(--accent-gold)',
                  background: 'rgba(212, 168, 83, 0.05)',
                  color: 'var(--text-secondary)',
                }}
                {...props}
              >
                {children}
              </blockquote>
            );
          },

          // 标题
          h1({ children, ...props }) {
            return <h1 style={{ fontSize: 18, fontWeight: 700, margin: '12px 0 6px' }} {...props}>{children}</h1>;
          },
          h2({ children, ...props }) {
            return <h2 style={{ fontSize: 16, fontWeight: 600, margin: '10px 0 4px' }} {...props}>{children}</h2>;
          },
          h3({ children, ...props }) {
            return <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px' }} {...props}>{children}</h3>;
          },

          // 分隔线
          hr(props) {
            return <hr style={{ border: 'none', borderTop: '1px solid var(--border-card)', margin: '12px 0' }} {...props} />;
          },

          // 段落
          p({ children, ...props }) {
            return <p style={{ margin: '6px 0', lineHeight: 1.7 }} {...props}>{children}</p>;
          },

          // 行内代码（备用）
          pre({ children, ...props }) {
            return <pre style={{ margin: 0 }} {...props}>{children}</pre>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
