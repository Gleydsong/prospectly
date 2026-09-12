import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { ScoreBadge } from '@/components/ui/score-badge';
import type { CustomFieldDefinition } from '@/features/custom-fields/api';
import { formatCustomFieldValue } from '@/features/custom-fields/format-custom-field-value';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import { isBuiltinLeadViewColumn, type LeadViewColumnKey } from '@/features/saved-views/lead-filter';
import type { LeadListItem } from '@/types';

export function leadDetailPath(leadId: string): string {
  return `/leads/${leadId}`;
}

export function leadColumnLabel(
  column: LeadViewColumnKey,
  fields: CustomFieldDefinition[],
  t: (key: string) => string,
): string {
  if (isBuiltinLeadViewColumn(column)) {
    return t(`leads.column.${column}`);
  }
  return fields.find((field) => field.id === column)?.name ?? column;
}

export function LeadColumnValue({
  column,
  lead,
  fields,
}: {
  column: LeadViewColumnKey;
  lead: LeadListItem;
  fields: CustomFieldDefinition[];
}) {
  if (!isBuiltinLeadViewColumn(column)) {
    const field = fields.find((item) => item.id === column);
    return (
      <span className="text-[color:var(--ink-muted)]">
        {formatCustomFieldValue(field, lead.customFieldValues?.[column])}
      </span>
    );
  }
  switch (column) {
    case 'companyName':
      return (
        <div className="flex items-center gap-2">
          <div>
            <Link
              to={leadDetailPath(lead.id)}
              className="font-medium text-[color:var(--ink)] hover:text-[color:var(--accent)] after:absolute after:inset-0"
            >
              {lead.companyName}
            </Link>
            <p className="text-xs text-[color:var(--ink-muted)]">
              {lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : '—')}
            </p>
          </div>
          {!lead.website ? (
            <Badge tone="amber" title="Sem website">
              <Globe className="h-3 w-3" aria-hidden /> sem site
            </Badge>
          ) : null}
        </div>
      );
    case 'city':
      return <span className="text-[color:var(--ink-muted)]">{lead.city ?? '—'}</span>;
    case 'status':
      return <LeadStatusBadge status={lead.status} />;
    case 'score':
      return <ScoreBadge score={lead.score} />;
    case 'owner':
      return <span className="text-[color:var(--ink-muted)]">{lead.owner?.name ?? '—'}</span>;
    case 'tags':
      return (
        <div className="flex flex-wrap gap-1">
          {(lead.tags ?? []).slice(0, 3).map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
        </div>
      );
    case 'segment':
      return (
        <span className="text-[color:var(--ink-muted)]">
          {lead.segment ?? (lead.category ? formatCategoryTag(lead.category) : '—')}
        </span>
      );
    case 'email':
      return <span className="text-[color:var(--ink-muted)]">{lead.email ?? '—'}</span>;
    case 'website':
      return <span className="text-[color:var(--ink-muted)]">{lead.website ?? '—'}</span>;
  }
}
