import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'purple' | 'mint' | 'teal';

const tones: Record<Tone, string> = {
  slate: 'bg-[color:var(--status-neutral-bg)] text-[color:var(--status-neutral-ink)]',
  green: 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success-ink)]',
  amber: 'bg-[color:var(--status-warning-bg)] text-[color:var(--status-warning-ink)]',
  red: 'bg-[color:var(--status-danger-bg)] text-[color:var(--status-danger-ink)]',
  blue: 'bg-[color:var(--status-info-bg)] text-[color:var(--status-info-ink)]',
  brand: 'bg-[color:var(--brand-soft)] text-[color:var(--brand-hover)]',
  purple: 'bg-[color:var(--status-purple-bg)] text-[color:var(--status-purple-ink)]',
  mint: 'bg-[color:var(--status-mint-bg)] text-[color:var(--status-mint-ink)]',
  teal: 'bg-[color:var(--status-teal-bg)] text-[color:var(--status-teal-ink)]',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'slate', ...props }: BadgeProps) {
  return (
    <span
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
