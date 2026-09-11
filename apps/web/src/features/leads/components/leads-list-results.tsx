import { Link } from 'react-router-dom';
import { Globe, Plus, Trash2 } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Pagination } from '@/components/ui/pagination';
import { ScoreBadge } from '@/components/ui/score-badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { CustomFieldDefinition } from '@/features/custom-fields/api';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import type { LeadViewColumnKey, LeadViewLayout } from '@/features/saved-views/lead-filter';
import type { LeadListItem } from '@/types';

import { LeadColumnValue, leadColumnLabel, leadDetailPath } from './lead-column-value';
import { LeadsKanban } from './leads-kanban';

export function LeadsListResults({
  layout,
  leads,
  columns,
  customFields,
  meta,
  isLoading,
  isError,
  waitingForReportIds,
  reportIdsFailed,
  kanbanLabel,
  deletePendingId,
  onPageChange,
  onCreate,
  onDelete,
  newClientLabel,
  t,
}: {
  layout: LeadViewLayout;
  leads: LeadListItem[];
  columns: LeadViewColumnKey[];
  customFields: CustomFieldDefinition[];
  meta?: { page: number; totalPages: number; total: number };
  isLoading: boolean;
  isError: boolean;
  waitingForReportIds: boolean;
  reportIdsFailed: boolean;
  kanbanLabel: string;
  deletePendingId?: string;
  onPageChange: (page: number) => void;
  onCreate: () => void;
  onDelete: (leadId: string, companyName: string) => void;
  newClientLabel: string;
  t: (key: string) => string;
}) {
  if (isLoading || waitingForReportIds) {
    return (
      <div className="p-5">
        <TableSkeleton rows={8} columns={5} />
      </div>
    );
  }

  if (isError || reportIdsFailed) {
    return (
      <div className="p-5">
        <Alert tone="error">Erro ao carregar clientes. Tente novamente.</Alert>
      </div>
    );
  }

  if (layout === 'kanban') {
    return (
      <div className="space-y-3 p-4 sm:p-5">
        <LeadsKanban leads={leads} label={kanbanLabel} />
        {meta ? (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={onPageChange}
          />
        ) : null}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="p-5">
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Ajuste os filtros ou crie o primeiro cliente manualmente."
          action={
            <Button onClick={onCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {newClientLabel}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-[color:var(--border)] md:hidden">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Link
              to={leadDetailPath(lead.id)}
              className="flex w-full flex-col gap-2 px-4 py-3.5 hover:bg-[color:var(--surface-hover)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-[color:var(--ink)]">{lead.companyName}</p>
                  <p className="text-xs text-[color:var(--ink-muted)]">
                    {[
                      lead.city,
                      lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : null),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </p>
                </div>
                <ScoreBadge score={lead.score} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LeadStatusBadge status={lead.status} />
                {!lead.website ? (
                  <Badge tone="amber" title="Sem site">
                    <Globe className="h-3 w-3" aria-hidden /> sem site
                  </Badge>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--border)] text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-5 py-3 font-medium">
                  {leadColumnLabel(column, customFields, t)}
                </th>
              ))}
              <th scope="col" className="px-5 py-3 font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="relative border-b border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
              >
                {columns.map((column) => (
                  <td key={column} className="px-5 py-3">
                    <LeadColumnValue column={column} lead={lead} fields={customFields} />
                  </td>
                ))}
                <td className="relative z-10 px-3 py-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Apagar cliente ${lead.companyName}`}
                    loading={deletePendingId === lead.id}
                    onClick={() => onDelete(lead.id, lead.companyName)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta ? (
        <div className="border-t border-[color:var(--border)] px-4 py-3">
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </>
  );
}
