import { Download, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ClientDenseList } from '@/components/ui/client-dense-row';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { downloadCsvFile } from '@/features/leads/api';
import { SearchQueryError } from '@/features/prospecting/components/search-query-error';
import { SearchResultCard } from '@/features/prospecting/components/search-result-card';
import { STATUS_LABEL } from '@/features/prospecting/search-presentation';
import { formatSearchImportStatus } from '@/lib/presentation-labels';
import type {
  ProspectingSearch,
  ProspectingSearchResult,
  SearchImportSummary,
} from '@/types';

const CSV_COLUMNS = [
  'empresa',
  'categoria',
  'telefone',
  'email',
  'website',
  'endereco',
  'cidade',
  'estado',
  'possui_site',
] as const;

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@|\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

function buildResultsCsv(results: ProspectingSearchResult[]): string {
  const rows = results.map((result) => {
    const business = result.normalizedData ?? result.data;
    return [
      business.companyName,
      business.category ?? '',
      business.phone ?? '',
      business.email ?? '',
      business.website ?? '',
      business.address ?? '',
      business.city,
      business.state,
      result.websitePresence === 'WEBSITE_FOUND' ? 'sim' : 'nao',
    ]
      .map(csvCell)
      .join(',');
  });
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}

function ImportSummaryNotice({ summary }: { summary: SearchImportSummary }) {
  return (
    <div className="space-y-2 rounded-control bg-[color:var(--surface-subtle)] p-3 text-sm text-[color:var(--ink)]" role="status">
      <p>
        Importação concluída: {summary.imported} importado(s), {summary.skipped} ignorado(s),{' '}
        {summary.invalid} inválido(s) e {summary.conflicts} possível(is) duplicado(s).
      </p>
      {summary.items && summary.items.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-brand-100/90">
          {summary.items.map((item) => (
            <li key={item.resultId}>
              {item.companyName ?? item.resultId}: {formatSearchImportStatus(item.status)}
              {item.leadId ? (
                <>
                  {' '}
                  —{' '}
                  <Link className="underline hover:text-[color:var(--accent)]" to={`/leads/${item.leadId}`}>
                    ver cliente
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SearchResults({
  currentSearch,
  results,
  resultsMeta,
  isLoading,
  isError,
  error,
  onRetry,
  importSummary,
  selectedResultIds,
  selectableResultIds,
  allCurrentResultsSelected,
  withoutWebsiteCount,
  canImport,
  importingResultId,
  importPending,
  onToggleResult,
  onToggleCurrentPage,
  onPageChange,
  onImportSelected,
  onImportOne,
}: {
  currentSearch: ProspectingSearch | undefined;
  results: ProspectingSearchResult[];
  resultsMeta?: { page: number; pageSize: number; total: number; totalPages: number };
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  importSummary: SearchImportSummary | null;
  selectedResultIds: string[];
  selectableResultIds: string[];
  allCurrentResultsSelected: boolean;
  withoutWebsiteCount: number;
  canImport: boolean;
  importingResultId: string | null;
  importPending: boolean;
  onToggleResult: (id: string) => void;
  onToggleCurrentPage: () => void;
  onPageChange: (page: number) => void;
  onImportSelected: () => void;
  onImportOne: (resultId: string) => void;
}) {
  const exportResultsCsv = () => {
    const exportable = selectedResultIds.length
      ? results.filter((result) => selectedResultIds.includes(result.id))
      : results;
    if (exportable.length === 0) return;
    downloadCsvFile(`prospectly-resultados-${Date.now()}.csv`, buildResultsCsv(exportable));
  };

  return (
    <Card>
      <CardHeader
        title="Resultados da pesquisa"
        description={
          currentSearch
            ? `${STATUS_LABEL[currentSearch.status]}${
                currentSearch.status === 'COMPLETED'
                  ? ' — selecione os resultados para enviar ao CRM.'
                  : ' — atualizando automaticamente enquanto estiver ativa.'
              }`
            : 'Carregando pesquisa.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={results.length === 0}
              onClick={exportResultsCsv}
            >
              <Download className="h-4 w-4" aria-hidden />
              Exportar CSV
            </Button>
            <Button
              size="sm"
              disabled={!canImport || selectedResultIds.length === 0}
              loading={importPending && importingResultId === null}
              onClick={onImportSelected}
            >
              <Send className="h-4 w-4" aria-hidden />
              Enviar para CRM ({selectedResultIds.length})
            </Button>
          </div>
        }
      />
      <CardContent className="space-y-4">
        {importSummary ? <ImportSummaryNotice summary={importSummary} /> : null}

        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : isError ? (
          <SearchQueryError
            title="Não foi possível carregar os resultados."
            error={error}
            onRetry={onRetry}
          />
        ) : results.length === 0 ? (
          <EmptyState
            title={
              currentSearch?.status === 'COMPLETED'
                ? 'Nenhum resultado encontrado'
                : 'A pesquisa ainda não tem resultados'
            }
            description={
              currentSearch?.status === 'FAILED'
                ? (currentSearch.error ?? 'A pesquisa não pôde ser concluída.')
                : 'Os resultados aparecerão aqui quando o processamento terminar.'
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--ink)]">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos os resultados desta página"
                  checked={allCurrentResultsSelected}
                  onChange={onToggleCurrentPage}
                  disabled={selectableResultIds.length === 0}
                  className="h-4 w-4 rounded border-[color:var(--border)] bg-[color:var(--surface-card)] text-brand-500 focus:ring-[color:var(--ring)]"
                />
                Selecionar todos
              </label>
              <p className="text-sm text-[color:var(--ink-muted)]">
                <span className="font-medium text-amber-600">{withoutWebsiteCount}</span> sem site
                {' · '}
                <span className="font-medium text-[color:var(--ink)]">
                  {resultsMeta?.total ?? results.length}
                </span>{' '}
                total
              </p>
            </div>

            <ClientDenseList className="rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)]">
              {results.map((result) => (
                <li key={result.id}>
                  <SearchResultCard
                    result={result}
                    selected={selectedResultIds.includes(result.id)}
                    selectable={canImport && !result.importedLeadId}
                    importing={importingResultId === result.id}
                    onToggle={onToggleResult}
                    onSendToCrm={onImportOne}
                  />
                </li>
              ))}
            </ClientDenseList>

            {resultsMeta ? <Pagination {...resultsMeta} onPageChange={onPageChange} /> : null}
            <p className="text-xs text-[color:var(--ink-muted)]">
              Resultados combinados de OpenStreetMap e Google Places quando disponíveis. Dados ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-[color:var(--ink)]"
              >
                colaboradores do OpenStreetMap
              </a>
              {' '}(ODbL) e Google, conforme a fonte de cada resultado.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
