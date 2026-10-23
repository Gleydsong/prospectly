import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlossSphere } from '@/components/ui/gloss-sphere';
import { SignalRing } from '@/components/ui/signal-ring';
import { getBillingStatus } from '@/features/billing/api';
import { clearCheckoutIntent, readCheckoutIntent } from '@/features/billing/checkout-intent';
import { isCheckoutConfirmed } from '@/features/billing/confirmation';
import { BILLING_STATUS_QUERY_KEY } from '@/features/billing/hooks';

const POLL_MS = 2500;
export const BILLING_SUCCESS_TIMEOUT_MS = 60_000;

export function BillingSuccessPage() {
  const { t } = useTranslation();
  const [timedOut, setTimedOut] = useState(false);
  const intent = readCheckoutIntent();

  const status = useQuery({
    queryKey: [...BILLING_STATUS_QUERY_KEY, 'success-poll'],
    queryFn: getBillingStatus,
    refetchInterval: (query) => {
      if (timedOut) return false;
      if (intent && query.state.data && isCheckoutConfirmed(intent, query.state.data)) return false;
      return POLL_MS;
    },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), BILLING_SUCCESS_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const confirmed = Boolean(intent && status.data && isCheckoutConfirmed(intent, status.data));

  useEffect(() => {
    if (confirmed) clearCheckoutIntent();
  }, [confirmed]);

  let state: 'confirming' | 'confirmed' | 'delayed' | 'error' = 'confirming';
  if (status.isError) state = 'error';
  else if (confirmed) state = 'confirmed';
  else if (timedOut) state = 'delayed';

  // Só a compra de pacote adiciona créditos; assinatura não tem quantidade fixa.
  const creditsAdded =
    intent?.purpose === 'credits' ? (intent.offer === 'credits-2000' ? 2000 : 5000) : null;
  const currentBalance = status.data?.creditBalance ?? null;

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-[color:var(--bg)] p-6 sm:p-10 select-none overflow-hidden">
      {/* Brand logo at top left */}
      <header className="relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] rounded-control"
        >
          <span className="font-display font-black text-xl text-[color:var(--ink)]">P.</span>
          <span className="font-display text-base font-bold text-[color:var(--ink)]">Prospectly</span>
        </Link>
      </header>

      {/* Main Content matching 06-pagamento-confirmado.png */}
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center text-center py-8">
        {/* 3D Ring with checkmark and GlossSphere */}
        <div className="relative mb-6 inline-flex items-center justify-center">
          <SignalRing size={140} glow />
          <div className="absolute inset-0 flex items-center justify-center">
            <Check className="h-10 w-10 text-[#2563EB] stroke-[3]" />
          </div>
          <GlossSphere
            variant="lima"
            size={36}
            className="absolute top-2 right-2 drop-shadow-md"
          />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-display text-[color:var(--ink)]">
          {t(`billing.successTitle.${state}`, {
            defaultValue: state === 'confirmed' ? 'Pagamento confirmado' : 'Confirmando pagamento',
          })}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-secondary)] max-w-md" role="status">
          {t(`billing.successBody.${state}`, {
            defaultValue: state === 'confirmed' ? 'Seus créditos já aparecem na conta.' : 'Estamos confirmando seu pagamento...',
          })}
        </p>

        {/* Balance confirmation card */}
        {creditsAdded !== null || currentBalance !== null ? (
          <div className="mt-8 w-full max-w-xs rounded-card border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-5 shadow-card text-center space-y-1">
            {creditsAdded !== null ? (
              <p className="font-display text-3xl font-extrabold tracking-tight text-[color:var(--ink)]">
                {`+${creditsAdded.toLocaleString('pt-BR')}`}{' '}
                <span className="text-sm font-normal text-[color:var(--ink-secondary)]">créditos</span>
              </p>
            ) : null}
            {currentBalance !== null ? (
              <p className="font-mono text-xs font-semibold text-[color:var(--brand-blue)]">
                {`${currentBalance.toLocaleString('pt-BR')} no saldo`}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* CTA Button */}
        <div className="mt-8">
          <Link to="/credits" onClick={() => clearCheckoutIntent()}>
            <Button size="lg" className="rounded-full px-8 py-3 shadow-soft font-semibold">
              {t('billing.backToCredits', { defaultValue: 'Voltar para créditos' })}
            </Button>
          </Link>
        </div>
      </main>

      <div className="h-6" aria-hidden="true" />
    </div>
  );
}

export function BillingCancelPage() {
  const { t } = useTranslation();

  useEffect(() => {
    clearCheckoutIntent();
    sessionStorage.removeItem('prospectly.pixCheckout');
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-[color:var(--bg)] p-6 sm:p-10 select-none overflow-hidden">
      {/* Brand logo at top left */}
      <header className="relative z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight text-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] rounded-control"
        >
          <span className="font-display font-black text-xl text-[color:var(--ink)]">P.</span>
          <span className="font-display text-base font-bold text-[color:var(--ink)]">Prospectly</span>
        </Link>
      </header>

      {/* Main Content matching 06-pagamento-cancelado.png */}
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center text-center py-8">
        {/* Soft rounded light-blue box with dark graphite GlossSphere */}
        <div className="mb-6 inline-flex items-center justify-center rounded-3xl bg-[#E2EDF7] dark:bg-slate-800 p-8 shadow-soft">
          <GlossSphere variant="tinta" size={56} />
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-display text-[color:var(--ink)]">
          {t('billing.cancelTitle', { defaultValue: 'Pagamento cancelado' })}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-secondary)] max-w-md">
          {t('billing.cancelBody', {
            defaultValue: 'Nenhuma cobrança foi feita. Você pode tentar de novo quando quiser.',
          })}
        </p>

        {/* Action buttons matching mockup */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/">
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-6 py-2.5 font-medium"
            >
              {t('billing.backToApp', { defaultValue: 'Voltar ao app' })}
            </Button>
          </Link>
          <Link to="/credits">
            <Button
              type="button"
              className="rounded-full px-6 py-2.5 shadow-soft font-medium"
            >
              {t('billing.tryAgain', { defaultValue: 'Tentar novamente' })}
            </Button>
          </Link>
        </div>
      </main>

      <div className="h-6" aria-hidden="true" />
    </div>
  );
}
