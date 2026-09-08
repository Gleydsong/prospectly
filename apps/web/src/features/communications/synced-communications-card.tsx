import { Calendar, ExternalLink, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { groupEmailsByThread, type SyncedCommunication } from '@/features/communications/api';
import { useSyncedCommunications } from '@/features/communications/hooks';
import { sanitizeExternalUrl } from '@/lib/safe-url';
import { formatDateTime } from '@/lib/utils';

export function SyncedCommunicationsCard({ leadId }: { leadId: string }) {
  const { t } = useTranslation();
  const query = useSyncedCommunications(leadId);
  const items = query.data?.data ?? [];
  const emails = items.filter((item) => item.channel === 'EMAIL');
  const events = items.filter((item) => item.channel === 'CALENDAR');
  const threads = groupEmailsByThread(emails);
  const empty = !query.isLoading && emails.length === 0 && events.length === 0;

  return (
    <Card>
      <CardHeader title={t('syncedCommunications.title')} />
      <CardContent className="space-y-4">
        {query.isLoading ? <Skeleton className="h-16 w-full" /> : null}
        {empty ? (
          <p className="text-sm text-[color:var(--ink-muted)]">{t('syncedCommunications.empty')}</p>
        ) : null}
        {threads.length > 0 ? (
          <section className="space-y-3">
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
          </section>
        ) : null}
        {events.length > 0 ? (
          <section className="space-y-3">
            {events.map((event) => (
              <CalendarEventRow key={event.id} event={event} />
            ))}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CalendarEventRow({ event }: { event: SyncedCommunication }) {
  const { t } = useTranslation();
  const href = sanitizeExternalUrl(event.htmlLink);
  return (
    <article className="rounded-lg border border-[color:var(--line)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-[color:var(--ink)]">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{event.subject || t('syncedCommunications.noSubject')}</span>
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-muted)]">
            {formatDateTime(event.occurredAt)}
          </p>
          {event.snippet ? (
            <p className="mt-2 line-clamp-2 text-sm text-[color:var(--ink)]">{event.snippet}</p>
          ) : null}
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[color:var(--brand)]"
          >
            {t('syncedCommunications.openInCalendar')}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}
