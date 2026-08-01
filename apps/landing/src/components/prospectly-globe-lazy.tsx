'use client';

import { useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

import { GlobeStaticFallback } from '@/components/globe/globe-static-fallback';

const ProspectlyGlobeCanvas = dynamic(
  () => import('@/components/prospectly-globe').then((m) => m.ProspectlyGlobe),
  { ssr: false, loading: () => <GlobeStaticFallback /> },
);

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function scheduleIdle(callback: () => void): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(callback, { timeout: 2500 });
    return () => w.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(callback, 200);
  return () => window.clearTimeout(id);
}

/**
 * Defers the Three.js globe chunk until the hero is visible and the browser is idle.
 * Keeps a static image for reduced-motion, missing WebGL, or before the heavy bundle loads.
 */
export function ProspectlyGlobeLazy({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoadCanvas, setShouldLoadCanvas] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    if (!canUseWebGL()) return;

    const host = hostRef.current;
    if (!host) return;

    let cancelIdle: (() => void) | undefined;
    let cancelled = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        cancelIdle = scheduleIdle(() => {
          if (!cancelled) setShouldLoadCanvas(true);
        });
      },
      { rootMargin: '120px' },
    );

    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelIdle?.();
    };
  }, [reduceMotion]);

  return (
    <div ref={hostRef} className={className}>
      {shouldLoadCanvas ? (
        <ProspectlyGlobeCanvas className="h-full w-full max-w-none" />
      ) : (
        <GlobeStaticFallback className="h-full w-full max-w-none" />
      )}
    </div>
  );
}
