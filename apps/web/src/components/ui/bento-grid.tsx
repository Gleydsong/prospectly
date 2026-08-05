import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

/**
 * Composição modular de 12 colunas. Usada em telas de visão geral;
 * telas operacionais densas (tabelas, formulários) continuam em layout linear.
 */
export function BentoGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('grid grid-cols-1 gap-4 lg:grid-cols-12', className)} {...props} />;
}

const spans = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  12: 'lg:col-span-12',
} as const;

interface BentoItemProps extends HTMLAttributes<HTMLDivElement> {
  span?: keyof typeof spans;
}

export function BentoItem({ span = 6, className, ...props }: BentoItemProps) {
  return <div className={cn('min-w-0', spans[span], className)} {...props} />;
}
