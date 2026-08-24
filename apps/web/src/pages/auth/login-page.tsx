import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createCheckoutSession,
  createCreditCheckout,
  login,
  type AuthResponse,
} from '@/features/auth/api';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';
import { billingAuthQuery } from '@/features/billing/auth-query';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import { setAppLocale } from '@/i18n';
import { getApiErrorCode, getApiErrorMessage, isApiTimeoutError } from '@/lib/api';
import { resolveInternalRedirect } from '@/lib/safe-url';
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
  const offer = useMemo(() => {
    const value = searchParams.get('offer');
    return value === 'credits-2000' || value === 'credits-5000' || value === 'unlimited'
      ? value
      : null;
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
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: searchParams.get('email')?.trim() ?? '',
      password: '',
    },
  });

  const finishAuth = async (response: AuthResponse) => {
    setAuth(response);
    await setAppLocale(response.user.locale ?? 'pt');

    if (plan) {
      try {
        const checkout = await createCheckoutSession({
          interval: plan,
          currency: 'BRL',
        });
        handleCheckoutResult(checkout, { purpose: 'plan', plan: 'monthly' });
        return;
      } catch {
        navigate(`/credits?upgrade=1&plan=${plan}`, { replace: true });
        return;
      }
    }

    if (offer === 'credits-2000' || offer === 'credits-5000') {
      try {
        const checkout = await createCreditCheckout({ offer });
        handleCheckoutResult(checkout, { purpose: 'credits', offer });
        return;
      } catch {
        navigate(`/credits?offer=${offer}`, { replace: true });
        return;
      }
    }

    if (offer === 'unlimited') {
      try {
        const checkout = await createCheckoutSession({
          interval: 'monthly',
          currency: 'BRL',
        });
        handleCheckoutResult(checkout, { purpose: 'plan', plan: 'monthly' });
        return;
      } catch {
        navigate('/credits?offer=unlimited', { replace: true });
        return;
      }
    }

    if (offer) {
      navigate(`/credits?offer=${offer}`, { replace: true });
      return;
    }

    const from = (location.state as { from?: string } | null)?.from;
    navigate(resolveInternalRedirect(from), { replace: true });
  };

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    try {
      const response = await login(values);
      await finishAuth(response);
    } catch (error) {
      if (isApiTimeoutError(error)) {
        setServerError(t('auth.requestTimeout'));
        return;
      }
      if (getApiErrorCode(error) === 'RATE_LIMITED') {
        setServerError(t('auth.tooManyAttempts'));
        return;
      }
      if (getApiErrorCode(error) === 'NO_ORGANIZATION') {
        setServerError(t('auth.noOrganization'));
        return;
      }
      const message = getApiErrorMessage(error);
      if (message === 'Invalid credentials') {
        setServerError(t('auth.invalidCredentials'));
        return;
      }
      if (message === 'Account temporarily locked. Try again later.') {
        setServerError(t('auth.accountTemporarilyLocked'));
        return;
      }
      setServerError(message);
    }
  };

  const registerHref = `/register${billingAuthQuery({ offer, plan })}`;

  return (
    <AuthShell
      title={t('auth.loginTitle')}
      subtitle={t('auth.loginSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link to={registerHref} className="font-medium text-brand-400 hover:text-brand-300">
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

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-400 hover:text-brand-300"
          >
            {t('auth.forgotLink')}
          </Link>
        </div>

        {serverError ? (
          <p className="rounded-control bg-red-500/10 p-3 text-sm text-red-300" role="alert">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {t('auth.login')}
        </Button>
      </form>

      <div className="mt-4">
        <GoogleSignInButton
          onSuccess={finishAuth}
          onError={(message) => {
            if (/accept the Terms/i.test(message) || /must accept/i.test(message)) {
              setServerError(t('auth.googleNeedsRegister'));
              return;
            }
            setServerError(message);
          }}
        />
      </div>
    </AuthShell>
  );
}
