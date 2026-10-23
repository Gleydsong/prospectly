import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';

import { AuthShell } from '@/components/layout/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  createCheckoutSession,
  createCreditCheckout,
  register as registerUser,
  type AuthResponse,
} from '@/features/auth/api';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';
import { billingAuthQuery } from '@/features/billing/auth-query';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import { getAppLocale, setAppLocale } from '@/i18n';
import { getApiErrorCode, getApiErrorMessage, isApiTimeoutError } from '@/lib/api';
import type { AppLocale } from '@/lib/locale';
import { useAuthStore } from '@/stores/auth.store';
import {
  PROFESSIONAL_PERSONAS,
  type ProfessionalPersona,
} from '@/features/organizations/professional-persona';

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';

  type RegisterForm = {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  locale: AppLocale;
  defaultPersona: ProfessionalPersona;
  personaOtherLabel?: string;
  acceptTerms: boolean;
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [conflictEmail, setConflictEmail] = useState<string | null>(null);

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
        defaultPersona: z.enum(PROFESSIONAL_PERSONAS),
        personaOtherLabel: z.string().optional(),
        acceptTerms: z
          .boolean({ required_error: t('auth.acceptTermsRequired') })
          .refine((value) => value === true, { message: t('auth.acceptTermsRequired') }),
      }).superRefine((data, ctx) => {
        if (data.defaultPersona !== 'outro') return;
        const trimmed = data.personaOtherLabel?.trim() ?? '';
        if (trimmed.length < 2 || trimmed.length > 40) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['personaOtherLabel'],
            message: t('persona.otherLabelRequired'),
          });
        }
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
    defaultValues: {
      locale: getAppLocale(),
      defaultPersona: 'vendedor',
      personaOtherLabel: '',
      acceptTerms: false,
    },
  });

  const locale = watch('locale');
  const acceptTerms = watch('acceptTerms');
  const organizationName = watch('organizationName');
  const defaultPersona = watch('defaultPersona');
  const personaOtherLabel = watch('personaOtherLabel');

  const finishAuth = async (response: AuthResponse, fallbackLocale?: AppLocale) => {
    setAuth(response);
    await setAppLocale(response.user.locale ?? fallbackLocale ?? 'pt');

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

    navigate(offer ? `/credits?offer=${offer}` : '/', { replace: true });
  };

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    setConflictEmail(null);
    try {
      const response = await registerUser({
        name: values.name,
        email: values.email,
        password: values.password,
        organizationName: values.organizationName,
        locale: values.locale,
        defaultPersona: values.defaultPersona,
        personaOtherLabel:
          values.defaultPersona === 'outro' ? values.personaOtherLabel?.trim() : null,
        acceptTerms: true,
      });
      await finishAuth(response, values.locale);
    } catch (error) {
      if (isApiTimeoutError(error)) {
        setServerError(t('auth.requestTimeout'));
        return;
      }
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setConflictEmail(values.email);
        setServerError(t('auth.registerConflict'));
        return;
      }
      if (getApiErrorCode(error) === 'RATE_LIMITED') {
        setServerError(t('auth.tooManyAttempts'));
        return;
      }
      setServerError(getApiErrorMessage(error));
    }
  };

  const onGoogleClickBlocked = () => {
    if (!acceptTerms) {
      setServerError(t('auth.acceptTermsRequired'));
    }
  };

  const conflictLoginHref = (() => {
    const params = new URLSearchParams(billingAuthQuery({ offer, plan }).replace(/^\?/, ''));
    if (conflictEmail) params.set('email', conflictEmail);
    const query = params.toString();
    return query ? `/login?${query}` : '/login';
  })();

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
      panelTitle={t('auth.panelTitleRegister')}
      panelEyebrow={t('auth.panelEyebrow')}
      panelDescription={t('auth.panelDescription')}
      leftSphereVariant="sinal"
      rightSphereVariant="lima"
      footer={
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span>{t('auth.hasAccount')}</span>
            <Link
              to={`/login${billingAuthQuery({ offer, plan })}`}
              className="font-semibold link-brand hover:underline"
            >
              {t('auth.login')}
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('auth.name')}
            autoComplete="name"
            placeholder="Marina Costa"
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label={t('auth.organization')}
            placeholder="Agência Norte Digital"
            error={errors.organizationName?.message}
            {...register('organizationName')}
          />
        </div>

        <Input
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          placeholder="marina@nortedigital.com.br"
          error={errors.email?.message}
          {...register('email')}
        />

        <div>
          <Input
            label={t('auth.password')}
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••"
            error={errors.password?.message}
            {...register('password')}
          />
          <p className="mt-1.5 text-xs text-[color:var(--ink-muted)]">
            {t('auth.passwordHelper')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          <Select
            label={t('persona.label')}
            value={defaultPersona}
            error={errors.defaultPersona?.message}
            onChange={(event) => {
              const next = event.target.value as ProfessionalPersona;
              setValue('defaultPersona', next, { shouldValidate: true });
              if (next !== 'outro') {
                setValue('personaOtherLabel', '', { shouldValidate: true });
              }
            }}
          >
            {PROFESSIONAL_PERSONAS.map((value) => (
              <option key={value} value={value}>
                {t(`persona.${value}`)}
              </option>
            ))}
          </Select>
        </div>

        {defaultPersona === 'outro' ? (
          <Input
            label={t('persona.otherLabel')}
            placeholder={t('persona.otherLabelPlaceholder')}
            error={errors.personaOtherLabel?.message}
            maxLength={40}
            {...register('personaOtherLabel')}
          />
        ) : null}

        {/* Lista de benefícios do cadastro fiel a 03-acesso-criar-conta.png */}
        <div className="my-5 space-y-3 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-4 text-xs">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4f56a] font-bold text-[10px] text-[#0b1220]"
            >
              ✓
            </span>
            <div>
              <p className="font-semibold text-[color:var(--ink)]">{t('auth.benefit1Title')}</p>
              <p className="text-[color:var(--ink-secondary)]">{t('auth.benefit1Subtitle')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4f56a] font-bold text-[10px] text-[#0b1220]"
            >
              ✓
            </span>
            <div>
              <p className="font-semibold text-[color:var(--ink)]">{t('auth.benefit2Title')}</p>
              <p className="text-[color:var(--ink-secondary)]">{t('auth.benefit2Subtitle')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4f56a] font-bold text-[10px] text-[#0b1220]"
            >
              ✓
            </span>
            <div>
              <p className="font-semibold text-[color:var(--ink)]">{t('auth.benefit3Title')}</p>
              <p className="text-[color:var(--ink-secondary)]">{t('auth.benefit3Subtitle')}</p>
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-xs text-[color:var(--ink-secondary)]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[color:var(--border-default)] text-[color:var(--brand)] focus:ring-[color:var(--ring)]"
            {...register('acceptTerms')}
          />
          <span>
            {t('auth.acceptTermsPrefix')}{' '}
            <a
              className="font-medium underline hover:text-[color:var(--ink)]"
              href={`${LANDING_URL}/terms`}
              target="_blank"
              rel="noreferrer"
            >
              {t('auth.terms')}
            </a>{' '}
            {t('auth.acceptTermsAnd')}{' '}
            <a
              className="font-medium underline hover:text-[color:var(--ink)]"
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
          <p className="text-xs text-[color:var(--status-danger-ink)]">{errors.acceptTerms.message}</p>
        ) : null}

        {serverError ? (
          <p
            className="rounded-control bg-[color:var(--status-danger-bg)] p-3 text-sm text-[color:var(--status-danger-ink)]"
            role="alert"
          >
            {serverError}
            {conflictEmail ? (
              <>
                {' '}
                <Link
                  to={conflictLoginHref}
                  className="font-semibold underline"
                >
                  {t('auth.registerConflictLogin')}
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary-tinta"
          className="w-full text-base font-semibold shadow-lg"
          loading={isSubmitting}
        >
          {plan ? t('auth.createAndPay') : t('auth.createAccount')}
        </Button>
      </form>

      <div
        className="mt-4"
        onClickCapture={(event) => {
          if (!acceptTerms) {
            event.preventDefault();
            event.stopPropagation();
            onGoogleClickBlocked();
          }
        }}
      >
        <GoogleSignInButton
          acceptTerms={acceptTerms ? true : undefined}
          organizationName={organizationName}
          locale={locale}
          defaultPersona={defaultPersona}
          personaOtherLabel={defaultPersona === 'outro' ? personaOtherLabel : null}
          disabled={!acceptTerms}
          onSuccess={(response) => finishAuth(response, locale)}
          onError={(message) => setServerError(message)}
        />
      </div>
    </AuthShell>
  );
}
