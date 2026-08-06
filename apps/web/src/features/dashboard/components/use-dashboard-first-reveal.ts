import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

const SESSION_KEY = 'prospectly:dashboard-reveal-v1';
const REVEAL_MS = 640;

export type RevealOrigin = { x: number; y: number; maxRadius: number };

function readSessionDone(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSessionDone(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    /* ignore quota / private mode */
  }
}

function computeOrigin(el: HTMLElement | null): RevealOrigin {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!el) {
    const x = Math.min(vw * 0.42, 520);
    const y = Math.min(vh * 0.28, 280);
    return {
      x,
      y,
      maxRadius: Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)),
    };
  }
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return {
    x,
    y,
    maxRadius: Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)),
  };
}

/**
 * First-load circular reveal (uma vez por sessão).
 * Sem light mode — só máscara clip-path no conteúdo da dashboard.
 */
export function useDashboardFirstReveal() {
  const reduce = useReducedMotion();
  const originRef = useRef<HTMLElement | null>(null);
  const [shouldAnimate] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return !readSessionDone();
  });
  const [origin, setOrigin] = useState<RevealOrigin | null>(null);
  const [active, setActive] = useState(shouldAnimate);
  const [complete, setComplete] = useState(!shouldAnimate);

  useEffect(() => {
    if (!shouldAnimate || reduce) {
      writeSessionDone();
      setActive(false);
      setComplete(true);
    }
  }, [shouldAnimate, reduce]);

  const setOriginEl = useCallback(
    (node: HTMLElement | null) => {
      originRef.current = node;
      if (!node || !shouldAnimate || reduce) return;
      requestAnimationFrame(() => {
        setOrigin(computeOrigin(node));
      });
    },
    [shouldAnimate, reduce],
  );
  const onRevealComplete = useCallback(() => {
    writeSessionDone();
    setActive(false);
    setComplete(true);
  }, []);

  return {
    active,
    complete,
    origin,
    durationMs: REVEAL_MS,
    setOriginEl,
    onRevealComplete,
  };
}
