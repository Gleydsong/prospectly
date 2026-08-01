import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { TableSkeleton } from '@/components/ui/skeleton';
import { useCampaigns, useCreateCampaign } from '@/features/campaigns/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  description: z.string().optional(),
  segment: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const STATUS_TONE: Record<string, 'slate' | 'green' | 'amber' | 'red' | 'blue'> = {
  DRAFT: 'slate',
  SCHEDULED: 'amber',
  RUNNING: 'green',
  PAUSED: 'amber',
  COMPLETED: 'blue',
  CANCELLED: 'red',
};

export function CampaignsPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campaignsQuery = useCampaigns({ page, pageSize: 20 });
  const createMutation = useCreateCampaign();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', segment: '' },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        segment: values.segment || undefined,
        channel: 'ASSISTED',
      });
      form.reset();
      setOpen(false);
    } catch (err) {
      setError(getApiErrorMessage(err) || t('campaigns.createError'));
    }
  }

  const rows = campaignsQuery.data?.data ?? [];
  const meta = campaignsQuery.data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-50">{t('campaigns.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">{t('campaigns.subtitle')}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('campaigns.create')}
        </Button>
      </div>

      <Card className="border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100/90">
        {t('campaigns.assistedNotice')}
      </Card>

      {campaignsQuery.isLoading ? (
        <TableSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={t('campaigns.emptyTitle')}
          description={t('campaigns.emptyDescription')}
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('campaigns.create')}
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('campaigns.columns.name')}</th>
                  <th className="px-4 py-3 font-medium">{t('campaigns.columns.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('campaigns.columns.segment')}</th>
                  <th className="px-4 py-3 font-medium">{t('campaigns.columns.leads')}</th>
                  <th className="px-4 py-3 font-medium">{t('campaigns.columns.updated')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-zinc-800/80 text-zinc-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-50">{campaign.name}</div>
                      {campaign.description ? (
                        <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                          {campaign.description}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[campaign.status] ?? 'slate'}>
                        {t(`campaigns.status.${campaign.status}`, { defaultValue: campaign.status })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{campaign.segment ?? '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{campaign._count?.leads ?? 0}</td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(campaign.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta ? (
            <div className="border-t border-zinc-800 p-3">
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t('campaigns.createTitle')}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">{t('campaigns.fields.name')}</label>
            <Input {...form.register('name')} autoFocus />
            {form.formState.errors.name ? (
              <p className="mt-1 text-xs text-red-400">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">{t('campaigns.fields.segment')}</label>
            <Input {...form.register('segment')} placeholder={t('campaigns.fields.segmentPlaceholder')} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-zinc-300">{t('campaigns.fields.description')}</label>
            <Input {...form.register('description')} />
          </div>
          <p className="text-xs text-zinc-500">{t('campaigns.createHint')}</p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              {t('campaigns.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
