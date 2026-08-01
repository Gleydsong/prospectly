import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/features/auth/api';
import { getApiErrorMessage } from '@/lib/api';

type ResetForm = { newPassword: string; confirmPassword: string };

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token')?.trim() ?? '', [params]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<'form' | 'ok'>('form');

  const schema = useMemo(
    () =>
      z
        .object({
          newPassword: z
            .string()
            .min(8, t('auth.passwordMin'))
            .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, t('auth.passwordPattern')),
          confirmPassword: z.string().min(1, t('auth.passwordRequired')),
        })
        .refine((values) => values.newPassword === values.confirmPassword, {
          message: t('auth.passwordMismatch'),
          path: ['confirmPassword'],
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: ResetForm) => {
    setServerError(null);
    try {
      await resetPassword({ token, newPassword: values.newPassword });
      setStatus('ok');
    } catch (error) {
      setServerError(getApiErrorMessage(error) || t('auth.resetError'));
    }
  };

  return (
    <AuthShell
      title={t('auth.resetTitle')}
      subtitle={t('auth.resetSubtitle')}
      footer={
        <>
          <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300">
            {t('auth.backToLogin')}
          </Link>
        </>
      }
    >
      {!token ? (
        <p className="text-sm text-red-300" role="alert">
          {t('auth.resetMissingToken')}
        </p>
      ) : status === 'ok' ? (
        <div className="space-y-4 text-sm">
          <p className="rounded-control bg-emerald-500/10 p-3 text-emerald-300" role="status">
            {t('auth.resetSuccess')}
          </p>
          <Link
            to="/login"
            className="inline-flex h-10 items-center justify-center rounded-control bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500"
          >
            {t('auth.backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label={t('auth.newPassword')}
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            label={t('auth.confirmPassword')}
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {serverError ? (
            <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('auth.resetSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
