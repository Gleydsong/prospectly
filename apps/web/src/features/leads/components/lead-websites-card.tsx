import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createLeadWebsite, deleteLeadWebsite, fetchLeadWebsites } from '@/features/leads/api';
import {
  LEAD_WEBSITE_KINDS,
  type LeadWebsiteKind,
} from '@/features/organizations/professional-persona';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { LeadWebsite } from '@/types';

type LeadWebsitesCardProps = {
  leadId: string;
  prominence: 'primary' | 'secondary';
  emphasized: boolean;
  canMutate: boolean;
};

const EMPTY_WEBSITES: LeadWebsite[] = [];

export function LeadWebsitesCard({
  leadId,
  prominence,
  emphasized,
  canMutate,
}: LeadWebsitesCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<LeadWebsiteKind>('site');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['lead-websites', leadId],
    queryFn: () => fetchLeadWebsites(leadId),
    enabled: Boolean(leadId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createLeadWebsite(leadId, {
        url: url.trim(),
        ...(label.trim() ? { label: label.trim() } : {}),
        kind,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: async () => {
      setUrl('');
      setLabel('');
      setKind('site');
      setNotes('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['lead-websites', leadId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (websiteId: string) => deleteLeadWebsite(leadId, websiteId),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['lead-websites', leadId] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const websites = query.data ?? EMPTY_WEBSITES;
  const title = emphasized ? t('leadWebsites.titleWon') : t('leadWebsites.title');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    createMutation.mutate();
  };

  return (
    <Card
      data-testid="lead-websites-card"
      data-prominence={prominence}
      className={cn(emphasized && 'border-brand-400')}
    >
      <CardHeader title={title} />
      <CardContent className="space-y-4">
        {query.isError ? <Alert tone="error">{t('leadWebsites.error')}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {websites.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('leadWebsites.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {websites.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-control border border-[color:var(--border)] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[color:var(--ink)]">
                    {row.label || row.url}
                  </p>
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="break-all text-xs text-brand-400 hover:underline"
                  >
                    {row.url}
                  </a>
                  <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                    {t(`leadWebsites.kind.${row.kind}`)}
                  </p>
                </div>
                {canMutate ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(row.id)}
                    loading={deleteMutation.isPending}
                  >
                    {t('leadWebsites.remove')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canMutate ? (
          <form className="space-y-3" onSubmit={onSubmit}>
            <Input
              label={t('leadWebsites.url')}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://"
              required
            />
            <Input
              label={t('leadWebsites.labelField')}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={120}
            />
            <Select
              label={t('leadWebsites.kindLabel')}
              value={kind}
              onChange={(event) => setKind(event.target.value as LeadWebsiteKind)}
            >
              {LEAD_WEBSITE_KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`leadWebsites.kind.${value}`)}
                </option>
              ))}
            </Select>
            <Input
              label={t('leadWebsites.notes')}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
            />
            <Button type="submit" variant="outline" size="sm" loading={createMutation.isPending}>
              {t('leadWebsites.add')}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
