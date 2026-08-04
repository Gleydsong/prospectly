import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

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
  const reduceMotion = useReducedMotion();

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

    let observer: ResizeObserver | undefined;
    let removeImageListeners: (() => void) | undefined;
    const syncHeight = () => {
      try {
        const doc = iframe.contentDocument;
        const body = doc?.body;
        const root = doc?.documentElement;
        const next = Math.max(
          minHeight,
          body?.scrollHeight ?? 0,
          body?.offsetHeight ?? 0,
          root?.scrollHeight ?? 0,
          root?.offsetHeight ?? 0,
        );
        setHeight(next);
      } catch {
        setHeight(minHeight);
      }
    };

    const observeContentHeight = () => {
      syncHeight();
      const doc = iframe.contentDocument;
      const documentElement = doc?.documentElement;
      const body = doc?.body;
      if (!documentElement || !body) return;

      const images = Array.from(doc.images);
      images.forEach((image) => image.addEventListener('load', syncHeight));
      removeImageListeners = () => {
        images.forEach((image) => image.removeEventListener('load', syncHeight));
      };

      if (typeof ResizeObserver === 'undefined') return;
      observer?.disconnect();
      observer = new ResizeObserver(syncHeight);
      observer.observe(documentElement);
      observer.observe(body);
    };

    iframe.addEventListener('load', observeContentHeight);
    return () => {
      iframe.removeEventListener('load', observeContentHeight);
      observer?.disconnect();
      removeImageListeners?.();
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
    <motion.iframe
      ref={iframeRef}
      title={title}
      srcDoc={srcDoc}
      sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"
      referrerPolicy="no-referrer"
      className={cn('w-full overflow-hidden rounded-control border border-zinc-800 bg-white', className)}
      style={{ height, minHeight }}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.2, 0, 0, 1] }}
    />
  );
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
