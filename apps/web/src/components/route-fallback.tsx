import { Skeleton } from '@/components/ui/skeleton';

export function RouteFallback() {
  return (
    <div className="space-y-4 p-6" role="status" aria-label="Carregando página">
      <Skeleton className="h-8 w-48 bg-zinc-800" />
      <Skeleton className="h-4 w-full max-w-xl bg-zinc-800" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 bg-zinc-800" />
        <Skeleton className="h-28 bg-zinc-800" />
      </div>
      <Skeleton className="h-64 w-full bg-zinc-800" />
    </div>
  );
}
