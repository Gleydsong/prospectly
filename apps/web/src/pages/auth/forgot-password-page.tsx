import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { forgotPassword } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';

type ForgotForm = { email: string };

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.emailInvalid')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: ForgotForm) => {
    setServerError(null);
    try {
      await forgotPassword(values.email);
      setSent(true);
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      subtitle={t('auth.forgotSubtitle')}
      panelTitle={t('auth.panelTitleForgot')}
      panelEyebrow={t('auth.panelEyebrow')}
      panelDescription={t('auth.panelDescription')}
      leftSphereVariant="sinal"
      rightSphereVariant="lima"
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium link-brand hover:underline"
        >
          <span>←</span>
          <span>{t('auth.loginBack')}</span>
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300" role="status">
          {t('auth.forgotSuccess')}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            error={errors.email?.message}
            {...register('email')}
          />

          {serverError ? (
            <p
              className="rounded-control bg-[color:var(--status-danger-bg)] p-3 text-sm text-[color:var(--status-danger-ink)]"
              role="alert"
            >
              {serverError}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary-tinta"
            className="w-full text-base font-semibold shadow-lg"
            loading={isSubmitting}
          >
            {t('auth.forgotSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
