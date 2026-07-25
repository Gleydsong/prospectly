import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createCheckoutSession, register as registerUser } from '@/features/auth/api';
import { setAppLocale } from '@/i18n';
import { getApiErrorMessage } from '@/lib/api';
import { detectBrowserLocale, type AppLocale } from '@/lib/locale';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import { useAuthStore } from '@/stores/auth.store';

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  locale: AppLocale;
  acceptTerms: boolean;
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const registerSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(2, t('auth.nameRequired')),
        email: z.string().email(t('auth.emailInvalid')),
        password: z
          .string()
          .min(8, t('auth.passwordMin'))
          .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, t('auth.passwordPattern')),
        organizationName: z.string().min(2, t('auth.orgRequired')),
        locale: z.enum(['pt', 'en']),
        acceptTerms: z
          .boolean({ required_error: t('auth.acceptTermsRequired') })
          .refine((value) => value === true, { message: t('auth.acceptTermsRequired') }),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { locale: detectBrowserLocale(), acceptTerms: false },
  });

  const locale = watch('locale');

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    try {
      const response = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        organizationName: values.organizationName,
        locale: values.locale,
        acceptTerms: true,
      });
      setAuth(response);
      await setAppLocale(response.user.locale ?? values.locale);

      if (plan) {
        try {
          const checkout = await createCheckoutSession({ interval: plan, currency });
          handleCheckoutResult(checkout);
          return;
        } catch {
          navigate(`/settings?upgrade=1&plan=${plan}&currency=${currency}`, { replace: true });
          return;
        }
      }

      navigate('/', { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <AuthShell
      title={t('auth.registerTitle')}
      subtitle={
        plan
          ? t('auth.registerPlanSubtitle', {
              plan: plan === 'monthly' ? t('auth.planMonthly') : t('auth.planLifetime'),
            })
          : t('auth.registerSubtitle')
      }
      footer={
        <>
          {t('auth.hasAccount')}{' '}
          <Link
            to={plan ? `/login?plan=${plan}&currency=${currency}` : '/login'}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            {t('auth.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label={t('auth.name')}
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label={t('auth.organization')}
          error={errors.organizationName?.message}
          {...register('organizationName')}
        />
        <Select
          label={t('auth.language')}
          value={locale}
          error={errors.locale?.message}
          onChange={(event) => {
            const next = event.target.value as AppLocale;
            setValue('locale', next, { shouldValidate: true });
            void setAppLocale(next);
          }}
        >
          <option value="pt">{t('auth.languagePt')}</option>
          <option value="en">{t('auth.languageEn')}</option>
        </Select>

        <label className="flex items-start gap-2 text-sm text-zinc-600">
          <input type="checkbox" className="mt-1" {...register('acceptTerms')} />
          <span>
            {t('auth.acceptTermsPrefix')}{' '}
            <a
              className="font-medium text-brand-600 hover:text-brand-700"
              href={`${LANDING_URL}/terms`}
              target="_blank"
              rel="noreferrer"
            >
              {t('auth.terms')}
            </a>{' '}
            {t('auth.acceptTermsAnd')}{' '}
            <a
              className="font-medium text-brand-600 hover:text-brand-700"
              href={`${LANDING_URL}/privacy`}
              target="_blank"
              rel="noreferrer"
            >
              {t('auth.privacy')}
            </a>
            .
          </span>
        </label>
        {errors.acceptTerms?.message ? (
          <p className="text-sm text-red-600">{errors.acceptTerms.message}</p>
        ) : null}

        {serverError ? (
          <p className="rounded-control bg-red-50 p-3 text-sm text-red-700" role="alert">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {plan ? t('auth.createAndPay') : t('auth.createAccount')}
        </Button>
      </form>
    </AuthShell>
  );
}
