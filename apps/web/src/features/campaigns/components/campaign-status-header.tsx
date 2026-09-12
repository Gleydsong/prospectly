import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { CampaignDetail, CampaignStatus } from '@/features/campaigns/api';
import { formatDate } from '@/lib/utils';

const STATUS_ACTIONS: Partial<Record<CampaignStatus, CampaignStatus[]>> = {
  DRAFT: ['SCHEDULED', 'RUNNING', 'CANCELLED'],
  SCHEDULED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'COMPLETED', 'CANCELLED'],
};

export function CampaignStatusHeader({
  campaign,
  statusPending,
  onStatus,
  onAddLeads,
}: {
  campaign: CampaignDetail;
  statusPending: boolean;
  onStatus: (status: CampaignStatus) => void;
  onAddLeads: () => void;
}) {
  const { t } = useTranslation();
  const nextStatuses = STATUS_ACTIONS[campaign.status] ?? [];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/campaigns"
            className="mb-2 inline-block text-sm text-[color:var(--ink)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {t('campaigns.backToList')}
          </Link>
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">{campaign.name}</h1>
          <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
            {campaign.description || t('campaigns.noDescription')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[color:var(--ink-muted)]">
            <Badge>
              {t(`campaigns.status.${campaign.status}`, {
                defaultValue: 'Estado não identificado',
              })}
            </Badge>
            <span>
              {t('campaigns.columns.segment')}: {campaign.segment ?? '—'}
            </span>
            <span>
              {t('campaigns.columns.owner')}: {campaign.owner?.name ?? '—'}
            </span>
            <span>
              {t('campaigns.columns.updated')}: {formatDate(campaign.updatedAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {nextStatuses.map((status) => (
            <Button
              key={status}
              type="button"
              size="sm"
              variant="ghost"
              loading={statusPending}
              onClick={() => onStatus(status)}
            >
              {t(`campaigns.statusAction.${status}`, {
                defaultValue: t(`campaigns.status.${status}`),
              })}
            </Button>
          ))}
          <Button type="button" onClick={onAddLeads}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            {t('campaigns.addLeads')}
          </Button>
        </div>
      </div>

      <Card
        className="border-amber-500/30 bg-amber-500/10 p-4 text-sm text-[color:var(--ink)]"
        role="note"
      >
        {t('campaigns.assistedNotice')}
      </Card>
    </>
  );
}
