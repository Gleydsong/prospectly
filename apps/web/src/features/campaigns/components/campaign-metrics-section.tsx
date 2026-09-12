import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import type { CampaignDetail, CampaignMetrics } from '@/features/campaigns/api';

const METRIC_KEYS = [
  'leads',
  'pending',
  'openTasks',
  'contacted',
  'replied',
  'meeting',
  'proposal',
  'won',
  'optOut',
] as const;

export function CampaignMetricsSection({
  campaign,
  metrics,
  createTasksPending,
  onCreateTasks,
}: {
  campaign: CampaignDetail;
  metrics: CampaignMetrics | undefined;
  createTasksPending: boolean;
  onCreateTasks: (stageId: string) => void;
}) {
  const { t } = useTranslation();
  const totals = {
    leads: metrics?.totals.leads ?? campaign._count?.leads ?? 0,
    pending: metrics?.totals.pending ?? 0,
    openTasks: metrics?.totals.openTasks ?? 0,
    contacted: metrics?.totals.contacted ?? 0,
    replied: metrics?.totals.replied ?? 0,
    meeting: metrics?.totals.meeting ?? 0,
    proposal: metrics?.totals.proposal ?? 0,
    won: metrics?.totals.won ?? 0,
    optOut: metrics?.totals.optOut ?? 0,
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METRIC_KEYS.map((key) => (
          <Card key={key} className="p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--ink-muted)]">
              {t(`campaigns.metrics.${key}`)}
            </div>
            <div className="mt-1 text-2xl font-semibold text-[color:var(--ink)]">{totals[key]}</div>
          </Card>
        ))}
      </div>
      {metrics ? (
        <p className="text-xs text-[color:var(--ink-muted)]">
          {metrics.eventsRecorded === 0
            ? t('campaigns.metrics.zeroEvents')
            : t('campaigns.metrics.eventsRecorded', { count: metrics.eventsRecorded })}
        </p>
      ) : null}

      <section className="space-y-3" aria-labelledby="campaign-stages-heading">
        <h2 id="campaign-stages-heading" className="text-lg font-medium text-[color:var(--ink)]">
          {t('campaigns.stagesTitle')}
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {(metrics?.stages ?? campaign.metrics?.stages ?? []).map((stage) => (
            <Card key={stage.id} className="p-4">
              <CardHeader
                title={stage.name}
                description={t(`campaigns.stageType.${stage.type}`, {
                  defaultValue: 'Etapa manual',
                })}
              />
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-[color:var(--ink-muted)]">
                <span>
                  {t('campaigns.metrics.leads')}:{' '}
                  {'leadCount' in stage ? stage.leadCount : (campaign.stageCounts?.[stage.id] ?? 0)}
                </span>
                <span>
                  {t('campaigns.metrics.openTasks')}: {'openTasks' in stage ? stage.openTasks : 0}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={createTasksPending}
                  onClick={() => onCreateTasks(stage.id)}
                >
                  {t('campaigns.createTasks')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
