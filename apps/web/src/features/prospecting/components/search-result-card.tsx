import { Globe, Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCategoryTag } from '@/features/opportunity-finder/format-category-tag';
import {
  buildWhatsAppLink,
  hasLikelyWhatsApp,
  preferredContactChannel,
} from '@/lib/brazilian-phone';
import { sanitizeMailtoHref, sanitizeTelHref, sanitizeExternalUrl } from '@/lib/safe-url';
import type { ProspectingSearchResult } from '@/types';
import { OpportunitySignalBadges, computeResultOpportunitySignal } from '../opportunity-signal';

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
  const whatsapp = hasLikelyWhatsApp({ phone: business.phone })
    ? buildWhatsAppLink(business.phone)
    : null;
  const phoneHref = whatsapp ?? sanitizeTelHref(business.phone);
  const emailHref = sanitizeMailtoHref(business.email);
  const channel = preferredContactChannel(business);
  const channelKey = {
    whatsapp: 'channelWhatsApp',
    email: 'channelEmail',
    phone: 'channelPhone',
    none: 'channelNone',
  }[channel];
  const website = sanitizeExternalUrl(business.website ?? '');
  return (
    <article
      id={`search-result-${result.id}`}
      tabIndex={-1}
      aria-label={business.companyName}
      className="flex h-full min-w-0 flex-col gap-4 rounded-card border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--ring)]"
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label={`${t('prospectResults.select')} ${business.companyName}`}
          checked={selected}
          disabled={!selectable || imported}
          onChange={() => onToggle(result.id)}
          className="mt-1 h-4 w-4 accent-[#2563EB]"
        />
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-[color:var(--ink)]">
            {business.companyName}
          </h3>
          <p className="text-sm text-[color:var(--ink-secondary)]">
            {[
              business.category && formatCategoryTag(business.category),
              business.city,
              business.state,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      </div>
      <OpportunitySignalBadges signal={signal} />
      <Badge tone="slate">
        {result.websitePresence === 'WEBSITE_FOUND'
          ? t('prospectResults.hasWebsite')
          : t('prospectResults.noWebsite')}
      </Badge>
      <div className="space-y-2 break-words text-sm text-[color:var(--ink-secondary)]">
        {business.address ? <p>{business.address}</p> : null}
        {business.phone ? (
          <p className="flex gap-2">
            <Phone className="h-4 w-4 shrink-0" aria-hidden />
            {phoneHref ? (
              <a
                href={phoneHref}
                target={whatsapp ? '_blank' : undefined}
                rel={whatsapp ? 'noopener noreferrer' : undefined}
                className="text-[color:var(--accent)] underline"
              >
                {business.phone}
              </a>
            ) : (
              business.phone
            )}
          </p>
        ) : null}
        {business.email ? (
          <p className="flex gap-2">
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            {emailHref ? <a href={emailHref}>{business.email}</a> : business.email}
          </p>
        ) : null}
        <p>{t(`clientRow.${channelKey}`)}</p>
        {website ? (
          <a
            className="flex gap-2 text-[color:var(--accent)] underline"
            href={website}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Globe className="h-4 w-4 shrink-0" aria-hidden />
            {t('prospectResults.openWebsite')}
          </a>
        ) : null}
        <p className="text-xs">
          {business.source === 'GOOGLE_PLACES' ? 'Google Places' : 'OpenStreetMap'}
        </p>
      </div>
      <Button
        variant="secondary"
        className="mt-auto"
        disabled={imported || !selectable}
        loading={importing}
        onClick={() => onSendToCrm(result.id)}
      >
        {imported ? t('prospectResults.saved') : t('prospectResults.addClient')}
      </Button>
    </article>
  );
}
