import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'purple';

const tones: Record<Tone, string> = {
  slate: 'bg-zinc-800 text-zinc-200',
  green: 'bg-brand-500/15 text-brand-300',
  amber: 'bg-amber-500/15 text-amber-300',
  red: 'bg-red-500/15 text-red-300',
  blue: 'bg-sky-500/15 text-sky-300',
  brand: 'bg-brand-500/15 text-brand-300',
  purple: 'bg-brand-500/10 text-brand-300',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'slate', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
