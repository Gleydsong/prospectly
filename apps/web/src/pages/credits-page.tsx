import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlossSphere } from '@/components/ui/gloss-sphere';
import { Modal } from '@/components/ui/modal';
import { MonoLabel } from '@/components/ui/mono-label';
import { PageHeader } from '@/components/ui/page-header';
import { SignalRing } from '@/components/ui/signal-ring';
import { Skeleton } from '@/components/ui/skeleton';
import {
  cancelBillingSubscription,
  createCheckoutSession,
  createCreditCheckout,
  getBillingStatus,
} from '@/features/auth/api';
import { canManageOrg } from '@/features/settings/can-manage-org';
import { handleCheckoutResult } from '@/features/billing/handle-checkout';
import { BillingProfileForm } from '@/features/billing/billing-profile-form';
import { BILLING_STATUS_QUERY_KEY } from '@/features/billing/hooks';
import { getApiErrorMessage } from '@/lib/api';
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
  const [historyOpen, setHistoryOpen] = useState(false);

  const billing = useQuery({
    queryKey: BILLING_STATUS_QUERY_KEY,
    queryFn: getBillingStatus,
    refetchInterval: (query) => (query.state.data?.checkoutReviewRequired === true ? 5_000 : false),
  });

  const creditCheckout = useMutation({
    mutationFn: (input: {
      offer: 'credits-2000' | 'credits-5000';
      paymentMethod: 'pix' | 'card';
    }) => createCreditCheckout(input),
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
    mutationFn: (paymentMethod: 'pix' | 'card') =>
      createCheckoutSession({ interval: 'monthly', currency: 'BRL', paymentMethod }),
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
  const checkoutBlocked = billing.data?.checkoutReviewRequired === true;

  const startCheckout = (offer: CreditOfferId, paymentMethod: 'pix' | 'card') => {
    setCreditOffer(offer);
    setBillingError(null);
    if (offer === 'unlimited') {
      planCheckout.mutate(paymentMethod);
      return;
    }
    creditCheckout.mutate({ offer, paymentMethod });
  };

  const balance = billing.data?.creditBalance ?? 0;
  const approxSearches = Math.floor(balance / 14);

  // Plan presentation string
  const planName =
    billing.data?.plan === 'STARTER_MONTHLY'
      ? 'Plano Mensal'
      : billing.data?.plan === 'LIFETIME'
        ? 'Plano Ilimitado'
        : 'Plano Gratuito';
  const searchesUsed = billing.data?.searchUsage?.used ?? 0;
  const searchLimit = billing.data?.freeSearchLimit ?? 3;
  const footerStatusText = `${planName} · ${searchesUsed} / ${searchLimit} buscas grátis`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Créditos"
        description="Cada busca consome 14 créditos depois das buscas grátis do plano."
        actions={
          <Button
            type="button"
            variant="outline"
            className="rounded-full px-5 py-2"
            onClick={() => setHistoryOpen(true)}
          >
            Histórico
          </Button>
        }
      />

      {billingError ? (
        <div
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
        >
          {billingError}
        </div>
      ) : null}

      {checkoutBlocked ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
          role="status"
        >
          {t('settings.checkoutReviewRequired', {
            defaultValue: 'Estamos confirmando seu checkout. Aguarde alguns instantes.',
          })}
        </div>
      ) : null}

      {/* Top row: Saldo Card & Uso nos últimos 30 dias Card */}
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Dark Saldo Card matching 06-creditos.png */}
        <section className="relative overflow-hidden rounded-panel bg-[#0B1220] p-6 sm:p-8 text-white shadow-card flex flex-col justify-between min-h-[220px]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="sr-only">Créditos disponíveis</span>
                <MonoLabel className="text-slate-400">SALDO</MonoLabel>
              </div>

              {billing.isLoading ? (
                <Skeleton className="h-14 w-32 bg-slate-800" />
              ) : (
                <p className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-white leading-none">
                  {balance.toLocaleString('pt-BR')}
                </p>
              )}

              <p className="text-sm text-slate-300 font-medium pt-1">
                {`créditos · cerca de ${approxSearches} buscas`}
              </p>
            </div>

            {/* 3D Graphic with SignalRing and GlossSphere */}
            <div className="relative shrink-0 flex items-center justify-center p-2">
              <SignalRing size={120} glow className="scale-90 sm:scale-100" />
              <GlossSphere
                variant="lima"
                size={34}
                className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 drop-shadow-lg"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-xs text-slate-400 font-mono tracking-wide">
            {footerStatusText}
          </div>
        </section>

        {/* Uso nos últimos 30 dias Card */}
        <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card flex flex-col justify-between">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-[color:var(--ink)]">
              Uso nos últimos 30 dias
            </h2>

            {/* A API ainda não expõe o consumo por período; sem dado real, não há gráfico. */}
            <p className="mt-6 text-sm leading-relaxed text-[color:var(--ink-secondary)]">
              {t('settings.usageUnavailable', {
                defaultValue: 'O histórico de consumo por período ainda não está disponível nesta conta.',
              })}
            </p>
          </div>
        </section>
      </div>

      {/* Bottom row: Packages (2.000, 5.000, Ilimitado) */}
      {!roleReady ? (
        <Skeleton className="h-64 rounded-panel" />
      ) : manage ? (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Package 1: 2.000 */}
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-7 shadow-card flex flex-col justify-between transition-all duration-200 hover:shadow-card-hover">
            <div>
              <p className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[color:var(--ink)] leading-none">
                2.000
              </p>
              <p className="mt-1 text-sm text-[color:var(--ink-secondary)]">
                créditos
              </p>

              <p className="mt-6 font-display text-2xl font-bold text-[color:var(--ink)]">
                R$ 14,99
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-secondary)]">
                ≈ 142 buscas
              </p>
            </div>

            <div className="mt-8 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full py-3 font-semibold"
                disabled={!emailVerified || checkoutPending || checkoutBlocked}
                loading={checkoutPending && creditOffer === 'credits-2000'}
                onClick={() => startCheckout('credits-2000', 'pix')}
              >
                Pagar com Pix
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)]"
                disabled={!emailVerified || checkoutPending || checkoutBlocked}
                onClick={() => startCheckout('credits-2000', 'card')}
              >
                Cartão de crédito ou débito
              </Button>
            </div>
          </section>

          {/* Package 2: 5.000 (Melhor preço - Highlighted) */}
          <section className="relative rounded-panel border-2 border-[color:var(--brand-blue)] bg-[color:var(--bg-surface)] p-6 sm:p-7 shadow-card flex flex-col justify-between transition-all duration-200 hover:shadow-card-hover">
            <div>
              <div className="mb-4">
                <Badge
                  tone="lima"
                  className="bg-[#D4F56A] text-[#1E3A8A] font-bold text-xs uppercase px-3 py-1 rounded-full border-none shadow-sm"
                >
                  MELHOR PREÇO
                </Badge>
              </div>

              <p className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[color:var(--ink)] leading-none">
                5.000
              </p>
              <p className="mt-1 text-sm text-[color:var(--ink-secondary)]">
                créditos
              </p>

              <p className="mt-6 font-display text-2xl font-bold text-[color:var(--ink)]">
                R$ 23,99
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-secondary)]">
                ≈ 357 buscas · melhor preço por crédito
              </p>
            </div>

            <div className="mt-8 space-y-2">
              <Button
                type="button"
                className="w-full rounded-full py-3 font-semibold shadow-soft"
                disabled={!emailVerified || checkoutPending || checkoutBlocked}
                loading={checkoutPending && creditOffer === 'credits-5000'}
                onClick={() => startCheckout('credits-5000', 'pix')}
              >
                Pagar com Pix
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)]"
                disabled={!emailVerified || checkoutPending || checkoutBlocked}
                onClick={() => startCheckout('credits-5000', 'card')}
              >
                Cartão de crédito ou débito
              </Button>
            </div>
          </section>

          {/* Package 3: Ilimitado (Only appears because it exists in the codebase) */}
          <section className="rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-7 shadow-card flex flex-col justify-between transition-all duration-200 hover:shadow-card-hover">
            <div>
              <p className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[color:var(--ink)] leading-none">
                Ilimitado
              </p>
              <p className="mt-1 text-sm text-[color:var(--ink-secondary)]">
                por mês
              </p>

              <p className="mt-6 font-display text-2xl font-bold text-[color:var(--ink)]">
                Mensal
              </p>
              <p className="mt-1 text-xs text-[color:var(--ink-secondary)]">
                Buscas sem limite. Preço na assinatura.
              </p>
            </div>

            <div className="mt-8 space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-full py-3 font-semibold"
                disabled={!emailVerified || checkoutPending || checkoutBlocked}
                loading={checkoutPending && creditOffer === 'unlimited'}
                onClick={() => startCheckout('unlimited', 'pix')}
              >
                Assinar ilimitado
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-xs text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)]"
                disabled={!emailVerified || checkoutPending || checkoutBlocked}
                onClick={() => startCheckout('unlimited', 'card')}
              >
                Cartão de crédito ou débito
              </Button>
            </div>
          </section>
        </div>
      ) : (
        <p className="text-sm text-[color:var(--ink-secondary)]">
          {t('settings.orgReadOnly', { defaultValue: 'Apenas administradores podem gerenciar créditos.' })}
        </p>
      )}

      {/* Subscription and billing profile management */}
      {manage ? (
        <div className="space-y-4 pt-4">
          <BillingProfileForm />

          {billing.data?.canCancelSubscription ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                disabled={!emailVerified || cancelSub.isPending}
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar assinatura
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Cancel subscription modal */}
      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancelar assinatura?"
      >
        <p className="text-sm text-[color:var(--ink-secondary)]">
          O cancelamento é imediato e você continuará com acesso aos créditos já adquiridos.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmCancel(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={cancelSub.isPending}
            onClick={() => cancelSub.mutate()}
          >
            {t('settings.cancelSubscriptionConfirm', { defaultValue: 'Confirmar cancelamento' })}
          </Button>
        </div>
      </Modal>

      {/* History modal */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Histórico de créditos"
      >
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--ink-secondary)] leading-relaxed">
            Todas as compras confirmadas e créditos consumidos por buscas e relatórios.
          </p>
          <div className="rounded-xl border border-[color:var(--border-default)] p-4 bg-[color:var(--bg-subtle)] text-xs font-mono space-y-2">
            <div className="flex justify-between">
              <span>Saldo atual:</span>
              <span className="font-bold">{balance} créditos</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Buscas grátis usadas:</span>
              <span>{searchesUsed} / {searchLimit}</span>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={() => setHistoryOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
