/**
 * MermaidDiagram 组件
 * 渲染 Mermaid 语法的流程图、序列图等
 * 带防抖：流式更新时不闪烁，等内容稳定后再渲染
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// 全局初始化，只执行一次
let initialized = false;

function initMermaid() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#2a2a3e',
      primaryTextColor: '#e0e0e0',
      primaryBorderColor: '#5a5a7a',
      lineColor: '#5a5a7a',
      secondaryColor: '#1e1e2e',
      tertiaryColor: '#16161e',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: '13px',
      nodeBorder: '#5a5a7a',
      clusterBkg: '#1e1e2e',
      clusterBorder: '#3a3a5a',
      titleColor: '#e0e0e0',
      edgeLabelBackground: '#1e1e2e',
    },
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
      padding: 16,
      nodeSpacing: 30,
      rankSpacing: 40,
    },
  });
  initialized = true;
}

interface MermaidDiagramProps {
  code: string;
}

/** 清理 mermaid.render() 留在 body 上的临时 SVG（含错误 SVG） */
function cleanupMermaidTemp(id: string) {
  // mermaid v11 可能创建多种 id 变体
  for (const suffix of ['', '-error', '-diagram']) {
    const el = document.getElementById(id + suffix);
    if (el) el.remove();
  }
}

let idCounter = 0;

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderedCodeRef = useRef<string>('');

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (code === renderedCodeRef.current) return;

    let cancelled = false;

    debounceRef.current = setTimeout(async () => {
      if (cancelled) return;
      const renderId = `mdia-${++idCounter}`;
      try {
        initMermaid();
        const { svg } = await mermaid.render(renderId, code);
        cleanupMermaidTemp(renderId);
        if (!cancelled) {
          renderedCodeRef.current = code;
          setSvgContent(svg);
          setError(false);
        }
      } catch (err) {
        console.error('[Mermaid] render error:', err);
        cleanupMermaidTemp(renderId);
        if (!cancelled) {
          setError(true);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
    };
  }, [code]);

  // 渲染失败时回退到代码块
  if (error) {
    return (
      <div style={{ position: 'relative', margin: '8px 0' }}>
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
          mermaid
        </div>
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
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        margin: '8px 0',
        padding: svgContent ? '12px 16px' : '8px 16px',
        borderRadius: 8,
        background: '#0d1117',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{
        __html: svgContent || '<span style="color: rgba(255,255,255,0.4); font-size: 12px;">渲染中...</span>',
      }}
    />
  );
}
