import { AtSign } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { resendVerification, verifyEmail } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

/**
 * VerifyEmailPage — Tela de confirmação de e-mail fiel a 03-acesso-verificar-email.png.
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
    <AuthShell
      title={t('auth.verifyTitleCard', 'Confira seu e-mail')}
      subtitle={
        user?.email
          ? t('auth.verifyBodyWithEmail', { email: user.email })
          : t('auth.verifySubtitle')
      }
      panelTitle={t('auth.panelTitleVerify')}
      panelEyebrow={t('auth.panelEyebrow')}
      panelDescription={t('auth.panelDescription')}
      leftSphereVariant="lima"
      rightSphereVariant="lima"
      footer={
        <Link
          to="/login"
          className="font-medium text-xs text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)] underline transition-colors"
        >
          {t('auth.useOtherEmail')}
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Cartão de status do e-mail com ícone @ */}
        <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-5 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand)] text-white shadow-md">
            <AtSign className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-sm text-[color:var(--ink)]">
              {t('auth.emailSentCardTitle')}
            </p>
            <p className="text-xs leading-relaxed text-[color:var(--ink-secondary)]">
              {t('auth.emailSentCardSubtitle')}
            </p>
          </div>
        </div>

        {/* Mensagens de feedback da verificação */}
        {!token ? (
          <p className="rounded-control bg-[color:var(--bg-subtle)] p-3 text-xs text-[color:var(--ink-muted)] text-center" role="alert">
            {t('auth.verifyMissingToken')}
          </p>
        ) : status === 'ok' ? (
          <div className="rounded-control bg-emerald-500/10 p-3 text-center text-sm font-medium text-emerald-400" role="status">
            {t('auth.verifySuccess')}
          </div>
        ) : status === 'error' ? (
          <p className="rounded-control bg-[color:var(--status-danger-bg)] p-3 text-center text-xs text-[color:var(--status-danger-ink)]" role="alert">
            {getApiErrorMessage(mutation.error) || t('auth.verifyError')}
          </p>
        ) : (
          <p className="text-center text-xs text-[color:var(--ink-muted)]">
            {t('auth.verifyPending')}
          </p>
        )}

        {resend.isError ? (
          <p className="rounded-control bg-[color:var(--status-danger-bg)] p-2.5 text-center text-xs text-[color:var(--status-danger-ink)]" role="alert">
            {getApiErrorMessage(resend.error)}
          </p>
        ) : null}

        {/* Ações */}
        <div className="space-y-3">
          <Button
            type="button"
            variant="secondary-outline"
            className="w-full text-sm font-semibold"
            loading={resend.isPending}
            disabled={resend.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isSuccess ? t('auth.verifyResent') : t('auth.resendLink')}
          </Button>

          {status === 'ok' ? (
            <Link
              to="/"
              className="cta-primary-tinta inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold shadow-md"
            >
              {t('auth.verifyGoApp', 'Ir para o aplicativo')}
            </Link>
          ) : null}

          <Link
            to="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[color:var(--border-default)] text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]"
          >
            {t('auth.goToLogin')}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
