import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-control bg-[color:var(--surface-subtle)]',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-[color:var(--surface-hover)] after:to-transparent',
        className,
      )}
      aria-hidden
    />
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
      aria-label="Carregando"
    >
      {Array.from({ length: items }).map((_, index) => (
        <Skeleton key={index} className="h-40 rounded-panel" />
      ))}
    </div>
  );
}
