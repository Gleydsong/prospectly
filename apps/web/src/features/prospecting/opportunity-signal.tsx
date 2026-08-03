import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  buildOpportunitySignal,
  type OpportunitySignal,
  type OpportunitySignalReasonKey,
  type OpportunitySignalTag,
} from '@prospectly/shared-types';
import type { WebsitePresence } from '@/types';

type BusinessLike = {
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
};

const TAG_TONE: Record<OpportunitySignalTag, 'amber' | 'green' | 'blue' | 'slate'> = {
  HIGH_POTENTIAL: 'amber',
  SITE_NOT_REPORTED: 'amber',
  NEW: 'blue',
  IN_CRM: 'green',
  HAS_CONTACT: 'slate',
};

export function computeResultOpportunitySignal(
  websitePresence: WebsitePresence,
  business: BusinessLike,
  inCrm: boolean,
): OpportunitySignal {
  return buildOpportunitySignal({
    websitePresence,
    phone: business.phone,
    email: business.email,
    whatsapp: business.whatsapp,
    rating: business.rating,
    reviewCount: business.reviewCount,
    inCrm,
  });
}

export function OpportunitySignalBadges({ signal }: { signal: OpportunitySignal }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={signal.level === 'HIGH' ? 'amber' : signal.level === 'MEDIUM' ? 'blue' : 'slate'}>
        {t(`opportunity.level.${signal.level}`)}
      </Badge>
      {signal.tags
        .filter((tag) => tag !== 'HIGH_POTENTIAL')
        .map((tag) => (
          <Badge key={tag} tone={TAG_TONE[tag]}>
            {t(`opportunity.tag.${tag}`)}
          </Badge>
        ))}
      <details className="relative">
        <summary
          className="inline-flex min-h-8 min-w-8 cursor-pointer list-none items-center justify-center rounded-control text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          aria-label={t('opportunity.explainAria')}
        >
          <Info className="h-4 w-4" aria-hidden />
        </summary>
        <div
          className="absolute left-0 z-20 mt-2 w-64 rounded-control border border-zinc-700 bg-zinc-900 p-3 text-xs text-zinc-300 shadow-lg"
          role="tooltip"
        >
          <p className="mb-2 font-medium text-zinc-100">{t('opportunity.explainTitle')}</p>
          <ul className="list-disc space-y-1 pl-4">
            {signal.reasons.map((reason: OpportunitySignalReasonKey) => (
              <li key={reason}>{t(`opportunity.reason.${reason}`)}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
