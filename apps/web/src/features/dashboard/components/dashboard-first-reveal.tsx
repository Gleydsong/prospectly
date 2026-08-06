import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type { RevealOrigin } from './use-dashboard-first-reveal';

interface DashboardFirstRevealProps {
  active: boolean;
  origin: RevealOrigin | null;
  durationMs: number;
  onComplete: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * Máscara circular expandindo do KPI/origem — mesma família do View Transition
 * clip-path do pin, sem trocar tema. Usa o mesmo nó DOM para não remountar filhos.
 */
export function DashboardFirstReveal({
  active,
  origin,
  durationMs,
  onComplete,
  className,
  children,
}: DashboardFirstRevealProps) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
  }, [active]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    if (!active || reduce) {
      el.style.clipPath = '';
      el.style.removeProperty('-webkit-clip-path');
      return;
    }

    if (!origin) {
      el.style.clipPath = 'circle(0px at 42% 28%)';
      el.style.setProperty('-webkit-clip-path', 'circle(0px at 42% 28%)');
      return;
    }

    const start = `circle(0px at ${origin.x}px ${origin.y}px)`;
    const end = `circle(${origin.maxRadius}px at ${origin.x}px ${origin.y}px)`;
    el.style.clipPath = start;
    el.style.setProperty('-webkit-clip-path', start);

    const anim = el.animate(
      [
        { clipPath: start, WebkitClipPath: start },
        { clipPath: end, WebkitClipPath: end },
      ],
      {
        duration: durationMs,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    );

    anim.onfinish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      el.style.clipPath = '';
      el.style.removeProperty('-webkit-clip-path');
      onComplete();
    };

    return () => {
      anim.cancel();
    };
  }, [active, origin, reduce, durationMs, onComplete]);

  return (
    <div
      ref={rootRef}
      className={cn('dashboard-first-reveal', className)}
      aria-busy={active && !reduce ? true : undefined}
    >
      {children}
    </div>
  );
}
