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
      footer={
        <>
          <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300">
            {t('auth.backToLogin')}
          </Link>
        </>
      }
    >
      {sent ? (
        <p className="rounded-control bg-emerald-500/10 p-3 text-sm text-emerald-300" role="status">
          {t('auth.forgotSuccess')}
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {serverError ? (
            <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('auth.forgotSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
