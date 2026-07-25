import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  cancelBillingSubscription,
  createBillingPortal,
  createCheckoutSession,
  getBillingStatus,
  requestDataDeletion,
  updateProfile,
} from '@/features/auth/api';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import { setAppLocale } from '@/i18n';
import { api, getApiErrorMessage } from '@/lib/api';
import type { AppLocale } from '@/lib/locale';
import { assignStripeRedirect } from '@/lib/safe-url';
import { useAuthStore } from '@/stores/auth.store';

interface Member {
  id: string;
  role: string;
  user: { id: string; name: string; email: string };
}

const LANDING_URL = import.meta.env.VITE_LANDING_URL ?? 'http://localhost:3001';

export function SettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [searchParams] = useSearchParams();
  const [locale, setLocale] = useState<AppLocale>((user?.locale as AppLocale) ?? 'pt');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [dsrMessage, setDsrMessage] = useState<string | null>(null);

  const planParam = searchParams.get('plan');
  const currencyParam = searchParams.get('currency');
  const defaultInterval =
    planParam === 'lifetime' || planParam === 'monthly' ? planParam : 'monthly';
  const defaultCurrency =
    currencyParam === 'BRL' || currencyParam === 'EUR' || currencyParam === 'USD'
      ? currencyParam
      : 'BRL';

  const members = useQuery({
    queryKey: ['organizations', 'members'],
    queryFn: async () => {
      const { data } = await api.get<Member[]>('/organizations/members');
      return data;
    },
  });

  const billing = useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
  });

  const saveLocale = useMutation({
    mutationFn: (next: AppLocale) => updateProfile({ locale: next }),
    onSuccess: async (data) => {
      updateUser({ locale: data.locale });
      await setAppLocale(data.locale);
      setMessage(t('settings.languageSaved'));
      setError(null);
    },
    onError: (err) => {
      setMessage(null);
      setError(getApiErrorMessage(err) || t('settings.languageError'));
    },
  });

  const checkout = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      handleCheckoutResult(data);
    },
    onError: (err) => setBillingError(getApiErrorMessage(err)),
  });

  const portal = useMutation({
    mutationFn: createBillingPortal,
    onSuccess: (data) => {
      assignStripeRedirect(data.url);
    },
    onError: (err) => setBillingError(getApiErrorMessage(err)),
  });

  const cancelSub = useMutation({
    mutationFn: cancelBillingSubscription,
    onSuccess: async () => {
      setBillingError(null);
      await queryClient.invalidateQueries({ queryKey: ['billing', 'status'] });
    },
    onError: (err) => setBillingError(getApiErrorMessage(err)),
  });

  const dsr = useMutation({
    mutationFn: () =>
      requestDataDeletion('Solicitação via app — exclusão de dados pessoais (LGPD)'),
    onSuccess: () => {
      setDsrMessage(t('settings.dsrSuccess'));
    },
    onError: (err) => setDsrMessage(getApiErrorMessage(err)),
  });

  const subscribeLabel =
    defaultCurrency === 'BRL' && defaultInterval === 'lifetime'
      ? t('settings.subscribeLifetimePix')
      : defaultCurrency === 'BRL' && defaultInterval === 'monthly'
        ? t('settings.subscribeMonthly')
        : t('settings.subscribe');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{t('settings.title')}</h1>
        <p className="text-sm text-zinc-500">{user?.organizationName}</p>
      </div>

      <Card>
        <CardHeader title={t('settings.languageTitle')} description={t('settings.languageDesc')} />
        <CardContent className="space-y-3">
          <Select
            label={t('auth.language')}
            value={locale}
            onChange={(event) => setLocale(event.target.value as AppLocale)}
          >
            <option value="pt">{t('auth.languagePt')}</option>
            <option value="en">{t('auth.languageEn')}</option>
          </Select>
          {message ? <p className="text-sm text-brand-700">{message}</p> : null}
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            loading={saveLocale.isPending}
            disabled={locale === (user?.locale ?? 'pt')}
            onClick={() => saveLocale.mutate(locale)}
          >
            {t('common.save')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.billingTitle')} description={t('settings.billingDesc')} />
        <CardContent className="space-y-4">
          {billing.isLoading ? (
            <Skeleton className="h-20" />
          ) : (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span>
                {t('settings.planLabel')}: <strong>{billing.data?.plan ?? 'FREE'}</strong>
              </span>
              <Badge tone={billing.data?.planStatus === 'ACTIVE' ? 'brand' : 'slate'}>
                {billing.data?.planStatus ?? 'INACTIVE'}
              </Badge>
              {billing.data?.planCurrency ? <span>{billing.data.planCurrency}</span> : null}
              <span className="text-zinc-500">
                {t('settings.freeSearches', { count: billing.data?.freeSearchLimit ?? 3 })}
              </span>
            </div>
          )}

          {billingError ? (
            <p className="rounded-control bg-red-50 p-3 text-sm text-red-700" role="alert">
              {billingError}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={checkout.isPending}
              onClick={() =>
                checkout.mutate({ interval: defaultInterval, currency: defaultCurrency })
              }
            >
              {subscribeLabel}
            </Button>
            {billing.data?.canOpenPortal ? (
              <Button
                type="button"
                variant="secondary"
                loading={portal.isPending}
                onClick={() => portal.mutate()}
              >
                {t('settings.stripePortal')}
              </Button>
            ) : null}
            {billing.data?.canCancelSubscription &&
            billing.data.paymentProvider === 'ABACATE' ? (
              <Button
                type="button"
                variant="outline"
                loading={cancelSub.isPending}
                onClick={() => cancelSub.mutate()}
              >
                {t('settings.cancelSubscription')}
              </Button>
            ) : null}
            <a
              className="inline-flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
              href={`${LANDING_URL}/pricing`}
              target="_blank"
              rel="noreferrer"
            >
              {t('settings.viewPricing')}
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.membersTitle')} description={t('settings.membersDesc')} />
        <CardContent>
          {members.isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {(members.data ?? []).map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{member.user.name}</p>
                    <p className="text-xs text-zinc-500">{member.user.email}</p>
                  </div>
                  <Badge tone={member.role === 'OWNER' ? 'brand' : 'slate'}>{member.role}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.privacyTitle')} description={t('settings.privacyDesc')} />
        <CardContent className="space-y-3">
          <p className="text-sm text-zinc-600">{t('settings.privacyBody')}</p>
          <Button type="button" variant="secondary" loading={dsr.isPending} onClick={() => dsr.mutate()}>
            {t('settings.requestDeletion')}
          </Button>
          {dsrMessage ? <p className="text-sm text-zinc-700">{dsrMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader title={t('settings.scoringTitle')} description={t('settings.scoringDesc')} />
        <CardContent>
          <p className="text-sm text-zinc-500">{t('settings.scoringSoon')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
