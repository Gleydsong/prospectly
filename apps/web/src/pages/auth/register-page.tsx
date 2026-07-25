import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { register as registerUser } from '@/features/auth/api';
import { setAppLocale } from '@/i18n';
import { getApiErrorMessage } from '@/lib/api';
import { detectBrowserLocale, type AppLocale } from '@/lib/locale';
import { useAuthStore } from '@/stores/auth.store';

type RegisterForm = {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  locale: AppLocale;
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

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
    defaultValues: { locale: detectBrowserLocale() },
  });

  const locale = watch('locale');

  const onSubmit = async (values: RegisterForm) => {
    setServerError(null);
    try {
      const response = await registerUser(values);
      setAuth(response);
      await setAppLocale(response.user.locale);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(getApiErrorMessage(error));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(5_150_105_/_0.12),_transparent_55%)]"
      />
      <div className="relative w-full max-w-md rounded-control border border-zinc-200/80 bg-white p-8 shadow-soft">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-control bg-brand-600 text-white">
            <Building2 className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('auth.registerTitle')}</h1>
          <p className="text-sm text-zinc-500">{t('auth.registerSubtitle')}</p>
        </div>

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

          {serverError ? (
            <p className="rounded-control bg-red-50 p-3 text-sm text-red-700" role="alert">
              {serverError}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={isSubmitting}>
            {t('auth.createAccount')}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
            {t('auth.login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
