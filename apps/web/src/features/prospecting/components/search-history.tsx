import { Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { SearchQueryError } from '@/features/prospecting/components/search-query-error';
import { formatSearchHeading, STATUS_LABEL, statusTone } from '@/features/prospecting/search-presentation';
import { formatDateTime } from '@/lib/utils';
import type { ProspectingSearch } from '@/types';

export function SearchHistory({
  searches,
  isLoading,
  isError,
  error,
  onRetry,
  meta,
  onPageChange,
  selectedSearchId,
  onSelect,
  onDelete,
  deletingSearchId,
}: {
  searches: ProspectingSearch[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  meta?: { page: number; pageSize: number; total: number; totalPages: number };
  onPageChange: (page: number) => void;
  selectedSearchId: string;
  onSelect: (searchId: string) => void;
  onDelete: (searchId: string) => void;
  deletingSearchId?: string;
}) {
  return (
    <Card>
      <CardHeader
        title="Histórico de pesquisas"
        description="Selecione uma pesquisa para acompanhar resultados."
      />
      <CardContent>
        {isLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : isError ? (
          <SearchQueryError
            title="Não foi possível carregar o histórico de pesquisas."
            error={error}
            onRetry={onRetry}
          />
        ) : searches.length === 0 ? (
          <EmptyState
            title="Nenhuma pesquisa"
            description="Crie uma pesquisa para começar a encontrar empresas."
          />
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-[color:var(--border)]" aria-label="Histórico de pesquisas">
              {searches.map((search) => (
                <li key={search.id}>
                  <div className="flex items-start gap-2 py-3">
                    <button
                      type="button"
                      onClick={() => onSelect(search.id)}
                      aria-pressed={search.id === selectedSearchId}
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left hover:bg-[color:var(--surface-hover)] focus-visible:rounded-control"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-[color:var(--ink)]">
                          {formatSearchHeading(search.input)}
                        </span>
                        <span className="text-sm text-[color:var(--ink-muted)]">
                          {formatDateTime(search.createdAt)}
                        </span>
                      </span>
                      <Badge tone={statusTone(search.status)}>{STATUS_LABEL[search.status]}</Badge>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      aria-label={`Apagar pesquisa ${formatSearchHeading(search.input)}`}
                      loading={deletingSearchId === search.id}
                      onClick={() => onDelete(search.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  {search.status === 'FAILED' && search.error ? (
                    <p className="pb-3 text-sm text-red-300">{search.error}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {meta ? <Pagination {...meta} onPageChange={onPageChange} /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
