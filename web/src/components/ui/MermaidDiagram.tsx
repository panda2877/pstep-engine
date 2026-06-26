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

export function MermaidDiagram({ code }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const renderedCodeRef = useRef<string>(''); // 已成功渲染的代码

  useEffect(() => {
    // 清除上一次的防抖定时器
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // 如果代码没变，不处理
    if (code === renderedCodeRef.current) return;

    // 防抖 400ms：流式更新时等内容稳定后再渲染
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      try {
        initMermaid();
        const { svg } = await mermaid.render(idRef.current, code);
        if (!cancelled) {
          renderedCodeRef.current = code;
          setSvgContent(svg);
          setError(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
    };

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
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

  // 有 SVG 就显示 SVG，没有则显示加载提示（首次渲染）
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
