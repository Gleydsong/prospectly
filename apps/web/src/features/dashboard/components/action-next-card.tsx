import { ArrowUpRight, CalendarClock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreBadge } from '@/components/ui/score-badge';
import { LeadStatusBadge } from '@/components/ui/lead-status-badge';
import { formatDate } from '@/lib/utils';
import type { LeadStatus } from '@/types';

interface ActionNextCardProps {
  loading?: boolean;
  overdue?: { id: string; companyName: string; nextContactAt: string } | null;
  opportunity?: {
    id: string;
    companyName: string;
    score: number;
    status: LeadStatus;
    city?: string | null;
  } | null;
  recommendationHref?: string | null;
}

export function ActionNextCard({
  loading,
  overdue,
  opportunity,
  recommendationHref,
}: ActionNextCardProps) {
  const { t } = useTranslation();

  const lead = overdue
    ? {
        id: overdue.id,
        title: overdue.companyName,
        subtitle: t('dashboard.nextActionOverdue', { date: formatDate(overdue.nextContactAt) }),
        href: `/leads/${overdue.id}`,
        kind: 'overdue' as const,
      }
    : opportunity
      ? {
          id: opportunity.id,
          title: opportunity.companyName,
          subtitle: opportunity.city ?? t('common.dash'),
          href: `/leads/${opportunity.id}`,
          kind: 'opportunity' as const,
          score: opportunity.score,
          status: opportunity.status,
        }
      : null;

  return (
    <Card
      surface="bento"
      className="group h-full transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-brand-400/35 hover:shadow-[0_12px_40px_-16px_rgb(37_99_235_/_0.45)]"
    >
      <CardHeader
        title={t('dashboard.nextAction')}
        description={t('dashboard.nextActionDesc')}
        className="border-b-0 pb-0"
      />
      <CardContent className="flex flex-1 flex-col gap-4 pt-3">
        {loading ? (
          <Skeleton className="h-28" />
        ) : !lead ? (
          <p className="text-sm text-zinc-500">{t('dashboard.nextActionEmpty')}</p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div
                className={
                  lead.kind === 'overdue'
                    ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300'
                    : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-brand-300'
                }
              >
                {lead.kind === 'overdue' ? (
                  <CalendarClock className="h-5 w-5" aria-hidden />
                ) : (
                  <Sparkles className="h-5 w-5" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-50">{lead.title}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{lead.subtitle}</p>
                {lead.kind === 'opportunity' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <LeadStatusBadge status={lead.status} />
                    <ScoreBadge score={lead.score} />
                  </div>
                ) : null}
              </div>
            </div>
            <Link
              to={lead.href}
              className="cta-glass inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors"
            >
              {t('dashboard.viewDetails')}
              <ArrowUpRight className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
            {recommendationHref ? (
              <Link
                to={recommendationHref}
                className="text-xs font-medium text-brand-300 hover:text-brand-200"
              >
                {t('dashboard.seeAllActions')}
              </Link>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
