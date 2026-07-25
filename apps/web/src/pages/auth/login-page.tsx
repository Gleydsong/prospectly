import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createCheckoutSession, login } from '@/features/auth/api';
import { setAppLocale } from '@/i18n';
import { getApiErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

type LoginForm = { email: string; password: string };

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const plan = useMemo(() => {
    const value = searchParams.get('plan');
    return value === 'lifetime' || value === 'monthly' ? value : null;
  }, [searchParams]);
  const currency = useMemo(() => {
    const value = searchParams.get('currency');
    return value === 'BRL' || value === 'EUR' || value === 'USD' ? value : 'BRL';
  }, [searchParams]);

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t('auth.emailInvalid')),
        password: z.string().min(1, t('auth.passwordRequired')),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const response = await login(values);
      setAuth(response);
      await setAppLocale(response.user.locale ?? 'pt');

      if (plan) {
        try {
          const checkout = await createCheckoutSession({ interval: plan, currency });
          window.location.assign(checkout.url);
          return;
        } catch {
          navigate(`/settings?upgrade=1&plan=${plan}&currency=${currency}`, { replace: true });
          return;
        }
      }

      const from = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(from, { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  const registerHref = plan ? `/register?plan=${plan}&currency=${currency}` : '/register';

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to={registerHref} className="font-medium text-brand-600 hover:text-brand-700">
            {t('auth.createAccount')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {serverError ? (
          <p className="rounded-control bg-red-50 p-3 text-sm text-red-700" role="alert">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('auth.login')}
        </Button>
      </form>
    </AuthShell>
  );
}
