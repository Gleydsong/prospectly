import { Headphones, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SUPPORT_EMAIL, buildSupportMailto } from '@/lib/support-email';
import { sanitizeMailtoHref } from '@/lib/safe-url';
import { useAuthStore } from '@/stores/auth.store';

export function SupportPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supportMailto = sanitizeMailtoHref(SUPPORT_EMAIL);

  return (
    <div className="mx-auto flex min-h-[min(680px,calc(100dvh-10rem))] max-w-2xl items-start justify-center py-6 lg:items-center">
      <Card className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-control bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
            <Headphones className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
            {t('support.title')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
            {t('support.subtitle')}
          </p>
          {supportMailto ? (
            <a href={supportMailto} className="link-brand mt-2 inline-block text-sm font-medium">
              {SUPPORT_EMAIL}
            </a>
          ) : null}

          {sent ? (
            <p className="mt-8 rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] px-4 py-3 text-sm text-[color:var(--ink)]">
              {t('support.sent', { email: SUPPORT_EMAIL })}
            </p>
          ) : (
            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const href = buildSupportMailto({
                  subject,
                  details,
                  fromName: user?.name,
                  fromEmail: user?.email,
                });
                if (!href) {
                  setError(t('support.sendError'));
                  return;
                }
                setError(null);
                window.location.assign(href);
                setSent(true);
              }}
            >
              <Input
                label={t('support.subject')}
                placeholder={t('support.subjectPlaceholder')}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
              />
              <Textarea
                label={t('support.details')}
                placeholder={t('support.detailsPlaceholder')}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                required
                className="min-h-[140px]"
              />
              {error ? (
                <p className="text-sm text-[color:var(--status-danger-ink)]" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-center pt-1">
                <Button type="submit" size="lg">
                  <Send className="h-4 w-4" aria-hidden />
                  {t('support.submit')}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
