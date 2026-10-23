import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MonoLabelProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
}

/**
 * MonoLabel — Rótulo mono em caixa alta segundo os fundamentos visuais.
 * Tipografia: Geist Mono 500, 12px, tracking +12%, uppercase.
 */
export function MonoLabel({ children, className, ...props }: MonoLabelProps) {
  return (
    <span
      className={cn(
        'font-mono text-xs font-medium uppercase tracking-mono-label text-[color:var(--ink-secondary)]',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
