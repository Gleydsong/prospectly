import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { ClientDenseRow, type ClientDenseRowMenuItem } from '@/components/ui/client-dense-row';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import {
  buildWhatsAppLink,
  hasLikelyWhatsApp,
  preferredContactChannel,
} from '@/lib/brazilian-phone';
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
  const { t } = useTranslation();
  const business = result.normalizedData ?? result.data;
  const imported = Boolean(result.importedLeadId);
  const signal = computeResultOpportunitySignal(result.websitePresence, business, imported);
  const hasWebsite = result.websitePresence === 'WEBSITE_FOUND';
  const location = [business.city, business.state].filter(Boolean).join(', ');
  const category = business.category ? formatCategoryTag(business.category) : null;
  const subtitle = [category, location].filter(Boolean).join(' · ') || null;
  const likelyWhatsApp = hasLikelyWhatsApp({ phone: business.phone });
  const channel = preferredContactChannel({ phone: business.phone, email: business.email });
  const whatsappHref = likelyWhatsApp ? buildWhatsAppLink(business.phone) : null;
  const safeWebsite = business.website ? sanitizeExternalUrl(business.website) : null;

  const menuItems: ClientDenseRowMenuItem[] = [];
  if (business.phone) {
    menuItems.push({
      id: 'copy-phone',
      label: t('clientRow.copyPhone'),
      onClick: () => {
        void navigator.clipboard?.writeText(business.phone ?? '');
      },
    });
  }
  if (safeWebsite) {
    menuItems.push({
      id: 'site',
      label: t('clientRow.openSite'),
      href: safeWebsite,
    });
  }

  return (
    <ClientDenseRow
      name={business.companyName}
      subtitle={subtitle}
      email={business.email}
      phone={business.phone}
      whatsappHref={whatsappHref}
      channel={channel}
      selected={selected}
      selectable={selectable && !imported}
      onToggle={() => onToggle(result.id)}
      status={
        <>
          <Badge tone={signal.level === 'HIGH' ? 'amber' : signal.level === 'MEDIUM' ? 'blue' : 'slate'}>
            {signal.level === 'HIGH' ? 'Quente' : signal.level === 'MEDIUM' ? 'Morno' : 'Frio'}
          </Badge>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
              SCORE_TONE[signal.level],
            )}
            title="Pontuação de oportunidade"
          >
            {signal.score}
          </span>
        </>
      }
      extraBadges={
        <Badge tone={hasWebsite ? 'green' : 'mint'} title={hasWebsite ? 'Tem site' : 'Sem site'}>
          <Globe className="h-3 w-3" aria-hidden />
          {hasWebsite ? 'Tem site' : 'Sem site'}
        </Badge>
      }
      primaryAction={{
        label: imported ? 'No CRM' : 'Enviar para CRM',
        disabled: imported || !selectable,
        loading: importing,
        onClick: () => onSendToCrm(result.id),
      }}
      menuItems={menuItems}
    />
  );
}
