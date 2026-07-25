import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand' | 'purple';

const tones: Record<Tone, string> = {
  slate: 'bg-zinc-100 text-zinc-700',
  green: 'bg-brand-100 text-brand-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-sky-100 text-sky-800',
  brand: 'bg-brand-100 text-brand-800',
  purple: 'bg-brand-50 text-brand-700',
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
