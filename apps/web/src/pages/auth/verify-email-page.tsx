import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthShell } from '@/components/layout/auth-shell';
import { verifyEmail } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
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

  useEffect(() => {
    if (token) mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per token
  }, [token]);

  return (
    <AuthShell title={t('auth.verifyTitle')} subtitle={t('auth.verifySubtitle')}>
      <div className="space-y-4 text-sm text-zinc-300">
        {!token ? (
          <p role="alert">{t('auth.verifyMissingToken')}</p>
        ) : status === 'ok' ? (
          <p className="text-emerald-300">{t('auth.verifySuccess')}</p>
        ) : status === 'error' ? (
          <p className="text-red-300" role="alert">
            {getApiErrorMessage(mutation.error) || t('auth.verifyError')}
          </p>
        ) : (
          <p>{t('auth.verifyPending')}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex h-10 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500"
          >
            {t('auth.verifyGoApp')}
          </Link>
          <Link
            to="/settings"
            className="inline-flex h-10 items-center justify-center rounded-control bg-zinc-800 px-4 text-sm font-medium text-zinc-50 hover:bg-zinc-700"
          >
            {t('nav.settings')}
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
