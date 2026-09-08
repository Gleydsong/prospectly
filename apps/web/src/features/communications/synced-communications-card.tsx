import { ExternalLink, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { groupEmailsByThread } from '@/features/communications/api';
import { useSyncedCommunications } from '@/features/communications/hooks';
import { sanitizeExternalUrl } from '@/lib/safe-url';
import { formatDateTime } from '@/lib/utils';

export function SyncedCommunicationsCard({ leadId }: { leadId: string }) {
  const { t } = useTranslation();
  const query = useSyncedCommunications(leadId);
  const items = query.data?.data ?? [];
  const threads = groupEmailsByThread(items);

  return (
    <Card>
      <CardHeader title={t('syncedCommunications.title')} />
      <CardContent className="space-y-3">
        {query.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {!query.isLoading && threads.length === 0 ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('syncedCommunications.empty')}</p>
        ) : null}
        {threads.map((thread) => {
          const href = sanitizeExternalUrl(thread.latest.htmlLink);
          return (
            <article
              key={thread.threadId}
              className="rounded-lg border border-[color:var(--line)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">
                      {thread.latest.subject || t('syncedCommunications.noSubject')}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
                    {formatDateTime(thread.latest.occurredAt)}
                    {thread.messages.length > 1
                      ? ` · ${t('syncedCommunications.messageCount', { count: thread.messages.length })}`
                      : ''}
                  </p>
                  {thread.latest.snippet ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[color:var(--ink)]">
                      {thread.latest.snippet}
                    </p>
                  ) : null}
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--brand)]"
                  >
                    {t('syncedCommunications.openInGmail')}
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}
