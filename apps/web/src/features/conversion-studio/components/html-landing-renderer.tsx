import { useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type HtmlLandingRendererProps = {
  html: string;
  title?: string;
  className?: string;
  minHeight?: number;
};

/**
 * Isolates AI-generated HTML in a sandboxed iframe (no scripts).
 * HTML must already be sanitized by the API.
 */
export function HtmlLandingRenderer({
  html,
  title = 'Landing',
  className,
  minHeight = 720,
}: HtmlLandingRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  const srcDoc = useMemo(() => {
    const trimmed = html.trim();
    if (!trimmed) return '';
    if (/<!DOCTYPE html>/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
      return trimmed;
    }
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeAttr(title)}</title></head><body>${trimmed}</body></html>`;
  }, [html, title]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const syncHeight = () => {
      try {
        const doc = iframe.contentDocument;
        const body = doc?.body;
        const next = Math.max(minHeight, body?.scrollHeight ?? minHeight);
        setHeight(next);
      } catch {
        setHeight(minHeight);
      }
    };

    iframe.addEventListener('load', syncHeight);
    const timer = window.setInterval(syncHeight, 800);
    return () => {
      iframe.removeEventListener('load', syncHeight);
      window.clearInterval(timer);
    };
  }, [srcDoc, minHeight]);

  if (!srcDoc) {
    return (
      <div className={cn('rounded-control border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-500', className)}>
        Pré-visualização HTML indisponível
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      referrerPolicy="no-referrer"
      className={cn('w-full overflow-hidden rounded-control border border-zinc-800 bg-white', className)}
      style={{ height, minHeight }}
    />
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
