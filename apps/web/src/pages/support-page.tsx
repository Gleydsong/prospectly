import { Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function SupportPage() {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto flex min-h-[min(680px,calc(100dvh-10rem))] max-w-2xl items-start justify-center py-6 lg:items-center">
      <Card className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-control bg-[color:var(--status-success-bg)] text-[color:var(--status-success-ink)]">
            <span className="text-lg font-bold" aria-hidden>
              ?
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            {t('support.title')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t('support.subtitle')}</p>

          {sent ? (
            <p className="mt-8 rounded-control border border-white/[0.08] bg-zinc-900/50 px-4 py-3 text-sm text-zinc-300">
              {t('support.sent')}
            </p>
          ) : (
            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
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
              <Button type="submit" size="lg">
                <Send className="h-4 w-4" aria-hidden />
                {t('support.submit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
