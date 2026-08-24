import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Coins, Crown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import {
  cancelBillingSubscription,
  createCheckoutSession,
  createCreditCheckout,
  getBillingStatus,
} from '@/features/auth/api';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import { BILLING_STATUS_QUERY_KEY } from '@/features/billing/hooks';
import { getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';

type CreditOfferId = 'credits-2000' | 'credits-5000' | 'unlimited';

function checkoutErrorMessage(error: unknown, fallback: string, emailHint: string): string {
  const message = getApiErrorMessage(error);
  if (message === 'EMAIL_NOT_VERIFIED') return emailHint;
  if (message && message !== 'Ocorreu um erro inesperado.') return message;
  return fallback;
}

export function CreditsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const emailVerified = Boolean(user?.emailVerifiedAt);
  const roleReady = Boolean(user?.role);
  const manage = canManageOrg(user?.role);

  const [billingError, setBillingError] = useState<string | null>(null);
  const [creditOffer, setCreditOffer] = useState<CreditOfferId | null>(() => {
    const value = searchParams.get('offer');
    return value === 'credits-2000' || value === 'credits-5000' || value === 'unlimited'
      ? value
      : null;
  });
  const [confirmCancel, setConfirmCancel] = useState(false);

  const billing = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: getBillingStatus,
  });

  const creditCheckout = useMutation({
    mutationFn: (input: { offer: 'credits-2000' | 'credits-5000' }) => createCreditCheckout(input),
    onSuccess: (data, variables) =>
      handleCheckoutResult(data, {
        purpose: 'credits',
        offer: variables.offer,
        baselineCreditBalance: billing.data?.creditBalance ?? 0,
      }),
    onError: (error) =>
      setBillingError(
        checkoutErrorMessage(error, t('settings.billingError'), t('settings.billingEmailHint')),
      ),
  });

  const planCheckout = useMutation({
    mutationFn: () => createCheckoutSession({ interval: 'monthly', currency: 'BRL' }),
    onSuccess: (data) =>
      handleCheckoutResult(data, {
        purpose: 'plan',
        plan: 'monthly',
        baselineCreditBalance: billing.data?.creditBalance ?? 0,
      }),
    onError: (error) =>
      setBillingError(
        checkoutErrorMessage(error, t('settings.billingError'), t('settings.billingEmailHint')),
      ),
  });

  const cancelSub = useMutation({
    mutationFn: cancelBillingSubscription,
    onSuccess: async () => {
      setConfirmCancel(false);
      setBillingError(null);
      await queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY });
    },
    onError: (error) =>
      setBillingError(
        checkoutErrorMessage(error, t('settings.billingError'), t('settings.billingEmailHint')),
      ),
  });

  const checkoutPending = creditCheckout.isPending || planCheckout.isPending;
  const startCheckout = (offer: CreditOfferId) => {
    setCreditOffer(offer);
    setBillingError(null);
    if (offer === 'unlimited') {
      planCheckout.mutate();
      return;
    }
    creditCheckout.mutate({ offer });
  };

  const offers = [
    {
      id: 'credits-2000' as const,
      title: t('settings.pack2000Title'),
      description: t('settings.creditPackagesDesc'),
      price: t('settings.pack2000Price'),
      cta: t('settings.buyCredits'),
      featured: false,
    },
    {
      id: 'credits-5000' as const,
      title: t('settings.pack5000Title'),
      description: t('settings.creditPackagesDesc'),
      price: t('settings.pack5000Price'),
      cta: t('settings.buyCredits'),
      featured: false,
    },
    {
      id: 'unlimited' as const,
      title: t('settings.packUnlimitedTitle'),
      description: t('settings.packUnlimitedDesc'),
      price: t('settings.packUnlimitedPrice'),
      suffix: t('settings.packUnlimitedSuffix'),
      cta: t('settings.subscribeUnlimited'),
      featured: true,
    },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={t('settings.creditsTitle')}
        title={t('settings.creditsPageTitle')}
        description={t('settings.creditsChoosePace')}
      />

      <Card className="overflow-hidden">
        <CardContent className="space-y-4 p-5">
          {billing.isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-panel border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4">
              <div>
                <p className="text-sm text-[color:var(--ink-muted)]">
                  {t('settings.availableCredits')}
                </p>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-[color:var(--ink)]">
                  {billing.data?.creditBalance ?? 0}
                </p>
              </div>
              <p className="max-w-[15rem] text-right text-xs leading-5 text-[color:var(--ink-muted)]">
                {t('settings.creditsUsageHint')}
              </p>
            </div>
          )}

          {billingError ? (
            <p
              className="rounded-control border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              role="alert"
            >
              {billingError}
            </p>
          ) : null}

          {!roleReady ? (
            <Skeleton className="h-48" />
          ) : manage ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {offers.map((offer) => {
                const pending = checkoutPending && creditOffer === offer.id;
                return (
                  <div
                    key={offer.id}
                    className={cn(
                      'relative flex flex-col rounded-panel border p-5 shadow-panel',
                      offer.featured
                        ? 'border-emerald-400/80 bg-emerald-500/10'
                        : 'border-[color:var(--border)] bg-[color:var(--surface-card)]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {offer.featured ? (
                        <Crown className="h-6 w-6 text-emerald-500" aria-hidden />
                      ) : (
                        <Coins className="h-6 w-6 text-amber-500" aria-hidden />
                      )}
                      {offer.featured ? (
                        <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                          {t('settings.bestChoice')}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-5 text-lg font-semibold tracking-tight text-[color:var(--ink)]">
                      {offer.title}
                    </h2>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-[color:var(--ink-muted)]">
                      {offer.description}
                    </p>
                    <p className="mt-5 text-2xl font-bold tracking-tight text-[color:var(--ink)]">
                      {offer.price}
                      {'suffix' in offer && offer.suffix ? (
                        <span className="ml-1 text-sm font-medium text-[color:var(--ink-muted)]">
                          {offer.suffix}
                        </span>
                      ) : null}
                    </p>

                    <ul className="mt-4 space-y-2 text-sm text-[color:var(--ink-muted)]">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        {offer.id === 'unlimited'
                          ? t('settings.packFeatureUnlimitedSearch')
                          : t('settings.packFeatureSearch')}
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        {offer.id === 'unlimited'
                          ? t('settings.packFeatureUnlimitedCsv')
                          : t('settings.packFeaturePdf')}
                      </li>
                      {offer.id === 'unlimited' ? (
                        <>
                          <li className="flex items-center gap-2">
                            <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                            {t('settings.packFeaturePixMonthly')}
                          </li>
                        </>
                      ) : null}
                    </ul>

                    <Button
                      type="button"
                      className="mt-5 w-full"
                      disabled={!emailVerified || checkoutPending}
                      loading={pending}
                      onClick={() => startCheckout(offer.id)}
                    >
                      {offer.cta}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[color:var(--ink-muted)]">{t('settings.orgReadOnly')}</p>
          )}

          {manage && !emailVerified ? (
            <p className="text-xs text-[color:var(--ink-muted)]">
              {t('settings.billingEmailHint')}
            </p>
          ) : null}

          {manage ? (
            <div className="flex flex-wrap items-center gap-2">
              {billing.data?.canCancelSubscription ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!emailVerified || cancelSub.isPending}
                  onClick={() => setConfirmCancel(true)}
                >
                  {t('settings.cancelSubscription')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={t('settings.cancelSubscriptionTitle')}
      >
        <p className="text-sm text-[color:var(--ink-muted)]">
          {t('settings.cancelSubscriptionBody')}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmCancel(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={cancelSub.isPending}
            onClick={() => cancelSub.mutate()}
          >
            {t('settings.cancelSubscriptionConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
