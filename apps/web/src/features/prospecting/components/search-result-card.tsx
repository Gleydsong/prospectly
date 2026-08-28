import { ExternalLink, Globe, MapPin, Phone, Send, Star } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import { sanitizeExternalUrl } from '@/lib/safe-url';
import { cn } from '@/lib/utils';
import type { ProspectingSearchResult } from '@/types';

import { computeResultOpportunitySignal } from '../opportunity-signal';

const SCORE_TONE = {
  HIGH: 'bg-brand-500/15 text-[color:var(--accent)]',
  MEDIUM: 'bg-sky-500/15 text-[color:var(--ink)]',
  LOW: 'bg-[color:var(--surface-subtle)] text-[color:var(--ink-muted)]',
} as const;

export interface SearchResultCardProps {
  result: ProspectingSearchResult;
  selected: boolean;
  selectable: boolean;
  importing: boolean;
  onToggle: (resultId: string) => void;
  onSendToCrm: (resultId: string) => void;
}

export function SearchResultCard({
  result,
  selected,
  selectable,
  importing,
  onToggle,
  onSendToCrm,
}: SearchResultCardProps) {
  const business = result.normalizedData ?? result.data;
  const imported = Boolean(result.importedLeadId);
  const signal = computeResultOpportunitySignal(result.websitePresence, business, imported);
  const hasWebsite = result.websitePresence === 'WEBSITE_FOUND';
  const location = [business.city, business.state].filter(Boolean).join(', ');
  const safeWebsite = business.website ? sanitizeExternalUrl(business.website) : null;

  return (
    <article
      className={cn(
        'flex h-full flex-col gap-3 rounded-control border bg-[color:var(--surface-card)] p-4 shadow-soft transition-colors',
        selected ? 'border-brand-500' : 'border-[color:var(--border)] hover:border-[color:var(--border-strong)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-[color:var(--ink)]" title={business.companyName}>
          {business.companyName}
        </h3>
        <input
          type="checkbox"
          aria-label={`Selecionar ${business.companyName}`}
          checked={selected}
          onChange={() => onToggle(result.id)}
          disabled={!selectable}
          title={
            imported
              ? 'Resultado já importado'
              : !selectable
                ? 'Aguarde a conclusão da pesquisa'
                : undefined
          }
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--border)] bg-[color:var(--surface-card)] text-brand-500 focus:ring-[color:var(--ring)]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {business.category ? <Badge>{formatCategoryTag(business.category)}</Badge> : null}
        <Badge tone={signal.level === 'HIGH' ? 'amber' : signal.level === 'MEDIUM' ? 'blue' : 'slate'}>
          {signal.level === 'HIGH' ? 'Quente' : signal.level === 'MEDIUM' ? 'Morno' : 'Frio'}
        </Badge>
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            SCORE_TONE[signal.level],
          )}
          title="Pontuação de oportunidade"
        >
          {signal.score}
        </span>
      </div>

      <dl className="space-y-1.5 text-xs text-[color:var(--ink-muted)]">
        {business.phone ? (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]" aria-hidden />
            <dt className="sr-only">Telefone</dt>
            <dd className="truncate">{business.phone}</dd>
          </div>
        ) : null}
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]" aria-hidden />
          <dt className="sr-only">Localização</dt>
          <dd className="truncate">{location || '—'}</dd>
          <Badge tone={hasWebsite ? 'green' : 'amber'} className="ml-1">
            <Globe className="h-3 w-3" aria-hidden />
            {hasWebsite ? 'Tem site' : 'Sem site'}
          </Badge>
        </div>
        {business.rating != null ? (
          <div className="flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            <dt className="sr-only">Avaliação</dt>
            <dd>
              {business.rating}
              {business.reviewCount != null ? ` · ${business.reviewCount} avaliações` : ''}
            </dd>
          </div>
        ) : null}
        {business.address ? (
          <div className="flex items-start gap-1.5">
            <dt className="sr-only">Endereço</dt>
            <dd className="line-clamp-2 text-[color:var(--ink-muted)]">{business.address}</dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-auto flex items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          disabled={imported || !selectable}
          loading={importing}
          onClick={() => onSendToCrm(result.id)}
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
          {imported ? 'No CRM' : 'Enviar para CRM'}
        </Button>
        {safeWebsite ? (
          <a
            href={safeWebsite}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-[color:var(--border)] px-3 text-sm text-[color:var(--ink)] hover:bg-[color:var(--surface-hover)]"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            Site atual
          </a>
        ) : null}
      </div>
    </article>
  );
}
