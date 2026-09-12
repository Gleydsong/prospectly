import { useNavigate } from 'react-router-dom';
import { Globe, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ClientDenseList,
  ClientDenseRow,
  type ClientDenseRowMenuItem,
} from '@/components/ui/client-dense-row';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import type { CustomFieldDefinition } from '@/features/custom-fields/api';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import {
  isBuiltinLeadViewColumn,
  type LeadViewColumnKey,
  type LeadViewLayout,
} from '@/features/saved-views/lead-filter';
import {
  buildWhatsAppLink,
  hasLikelyWhatsApp,
  preferredContactChannel,
} from '@/lib/brazilian-phone';
import type { LeadListItem } from '@/types';

import { LeadColumnValue, leadDetailPath } from './lead-column-value';
import { LeadsKanban } from './leads-kanban';

function LeadListDenseRow({
  lead,
  columns,
  fields,
  deleting,
  onOpen,
  onDelete,
}: {
  lead: LeadListItem;
  columns: LeadViewColumnKey[];
  fields: CustomFieldDefinition[];
  deleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const likelyWhatsApp =
    !lead.doNotContact && hasLikelyWhatsApp({ phone: lead.phone, whatsapp: lead.whatsapp });
  const channel = preferredContactChannel({
    phone: lead.phone,
    email: lead.email,
    whatsapp: lead.whatsapp,
  });
  const whatsappHref = likelyWhatsApp
    ? buildWhatsAppLink(lead.whatsapp || lead.phone)
    : null;
  const subtitle = [
    lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : null),
    lead.city,
  ]
    .filter(Boolean)
    .join(' · ');
  const customExtras = columns.filter((column) => !isBuiltinLeadViewColumn(column));
  const menuItems: ClientDenseRowMenuItem[] = [];
  if (whatsappHref) {
    menuItems.push({
      id: 'whatsapp',
      label: t('clientRow.openWhatsApp'),
      href: whatsappHref,
    });
  }
  if (lead.phone) {
    menuItems.push({
      id: 'copy-phone',
      label: t('clientRow.copyPhone'),
      onClick: () => {
        void navigator.clipboard?.writeText(lead.phone ?? '');
      },
    });
  }
  menuItems.push({
    id: 'delete',
    label: t('leads.deleteClient'),
    onClick: onDelete,
    danger: true,
    disabled: deleting,
  });

  return (
    <ClientDenseRow
      name={lead.companyName}
      subtitle={subtitle || null}
      tags={(lead.tags ?? []).map((tag) => ({ id: tag.id, label: tag.name }))}
      email={lead.email}
      phone={lead.phone}
      whatsappHref={whatsappHref}
      channel={lead.doNotContact ? 'none' : channel}
      status={<LeadStatusBadge status={lead.status} />}
      extraBadges={
        <>
          {!lead.website ? (
            <Badge tone="mint" title="Sem website">
              <Globe className="h-3 w-3" aria-hidden /> sem site
            </Badge>
          ) : null}
          {customExtras.map((column) => (
            <span key={column} className="text-xs text-[color:var(--ink-secondary)]">
              <LeadColumnValue column={column} lead={lead} fields={fields} />
            </span>
          ))}
        </>
      }
      primaryAction={{
        label: t('principal.open'),
        onClick: onOpen,
      }}
      menuItems={menuItems}
      onActivate={onOpen}
    />
  );
}

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
  const navigate = useNavigate();

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
      <ClientDenseList>
        {leads.map((lead) => (
          <li key={lead.id}>
            <LeadListDenseRow
              lead={lead}
              columns={columns}
              fields={customFields}
              deleting={deletePendingId === lead.id}
              onOpen={() => navigate(leadDetailPath(lead.id))}
              onDelete={() => onDelete(lead.id, lead.companyName)}
            />
          </li>
        ))}
      </ClientDenseList>
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
