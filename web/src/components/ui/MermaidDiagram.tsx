/**
 * MermaidDiagram 组件
 * 渲染 Mermaid 语法的流程图、序列图等
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
      // 流程图节点颜色
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

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        initMermaid();
        const { svg } = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          setSvgContent(svg);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          // Mermaid 渲染失败时回退到代码块显示
          console.error('[Mermaid] render error:', err);
          setError(err?.message || '渲染失败');
        }
      }
    }

    render();

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
        padding: '12px 16px',
        borderRadius: 8,
        background: '#0d1117',
        overflowX: 'auto',
        display: 'flex',
        justifyContent: 'center',
      }}
      dangerouslySetInnerHTML={{ __html: svgContent || '<div style="color: rgba(255,255,255,0.4); font-size: 12px;">加载中...</div>' }}
    />
  );
}
