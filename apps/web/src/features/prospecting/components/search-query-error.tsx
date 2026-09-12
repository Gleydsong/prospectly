import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';

export function SearchQueryError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-control bg-red-500/10 p-4 text-sm text-red-300" role="alert">
      <p className="font-medium">{title}</p>
      <p className="mt-1">{getApiErrorMessage(error)}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
