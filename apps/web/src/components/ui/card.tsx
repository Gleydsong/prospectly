import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-control border border-zinc-800 bg-zinc-900 shadow-soft', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-zinc-800 p-5', className)}>
      <div>
        <h3 className="text-base font-semibold tracking-tight text-zinc-50">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-zinc-400">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
