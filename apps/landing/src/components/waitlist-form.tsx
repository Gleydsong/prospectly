'use client';

import { useState, type FormEvent } from 'react';
import { CtaButton } from '@/components/ui/cta-button';
import { t, type Locale } from '@/lib/i18n';

export function WaitlistForm({ locale }: { locale: Locale }) {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === 'loading') return;

    setStatus('loading');
    setMessage('');

    try {
      // Same-origin Next route — landing works standalone (Resend) without Nest API
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          locale,
          source: 'landing-home',
          website: honeypot,
        }),
      });

      const data = (await res.json().catch(() => null)) as { message?: string } | null;

      if (!res.ok) {
        setStatus('error');
        setMessage(data?.message ?? t(locale, 'waitlistError'));
        return;
      }

      setStatus('success');
      setMessage(data?.message ?? t(locale, 'waitlistSuccess'));
      setEmail('');
    } catch {
      setStatus('error');
      setMessage(t(locale, 'waitlistError'));
    }
  }

  if (status === 'success') {
    return (
      <p className="mt-8 max-w-md text-base font-medium text-accent" role="status">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 w-full max-w-md" noValidate>
      <label htmlFor="waitlist-email" className="sr-only">
        {t(locale, 'waitlistEmailLabel')}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <input
          id="waitlist-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t(locale, 'waitlistEmailPlaceholder')}
          className="focus-ring h-12 w-full flex-1 rounded-control border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-4 text-sm text-[color:var(--ink)] placeholder:text-[color:var(--ink-muted)]"
          disabled={status === 'loading'}
        />
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
        />
        <CtaButton
          type="submit"
          disabled={status === 'loading' || email.trim().length === 0}
          className="shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? t(locale, 'waitlistSubmitting') : t(locale, 'waitlistSubmit')}
        </CtaButton>
      </div>
      {status === 'error' ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {message}
        </p>
      ) : (
        <p className="mt-3 text-sm text-[color:var(--ink-muted)]">{t(locale, 'waitlistHint')}</p>
      )}
    </form>
  );
}
