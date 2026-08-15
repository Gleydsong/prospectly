import { Mail } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/features/theme/theme-toggle';
import { resendVerification, verifyEmail } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Confirm email — layout Facilitey (card centrado + grelha), acento cinza.
 */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  const mutation = useMutation({
    mutationFn: () => verifyEmail(token),
    onSuccess: () => {
      updateUser({ emailVerifiedAt: new Date().toISOString() });
      setStatus('ok');
    },
    onError: () => setStatus('error'),
  });

  const resend = useMutation({
    mutationFn: resendVerification,
  });

  useEffect(() => {
    if (token) mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per token
  }, [token]);

  return (
    <div className="auth-confirm relative flex min-h-[100dvh] items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md rounded-panel border border-[color:var(--border)] bg-[color:var(--surface-card)] p-8 shadow-panel backdrop-blur-xl sm:p-10">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-control bg-[color:var(--status-success-bg)] text-[color:var(--status-success-ink)]">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-center text-sm font-semibold text-[color:var(--status-success-ink)]">
          {t('auth.verifyEyebrow')}
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-[1.75rem]">
          {t('auth.verifyTitleCard')}
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-[color:var(--ink-muted)]">
          {user?.email
            ? t('auth.verifyBodyWithEmail', { email: user.email })
            : t('auth.verifySubtitle')}
        </p>

        <div className="mt-8 space-y-3 text-center text-sm">
          {!token ? (
            <p className="text-[color:var(--ink-muted)]" role="alert">
              {t('auth.verifyMissingToken')}
            </p>
          ) : status === 'ok' ? (
            <p className="font-medium text-[color:var(--status-success-ink)]">
              {t('auth.verifySuccess')}
            </p>
          ) : status === 'error' ? (
            <p className="text-red-400" role="alert">
              {getApiErrorMessage(mutation.error) || t('auth.verifyError')}
            </p>
          ) : (
            <p className="text-[color:var(--ink-muted)]">{t('auth.verifyPending')}</p>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Button
            className="w-full"
            size="lg"
            loading={resend.isPending}
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isSuccess ? t('auth.verifyResent') : t('auth.resendLink')}
          </Button>
          {resend.isError ? (
            <p className="text-center text-xs text-red-400" role="alert">
              {getApiErrorMessage(resend.error)}
            </p>
          ) : null}
          <Link
            to="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-control border border-[color:var(--border)] text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-hover)]"
          >
            {t('auth.goToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
