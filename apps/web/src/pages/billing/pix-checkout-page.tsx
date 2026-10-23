import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { MonoLabel } from '@/components/ui/mono-label';
import { getBillingStatus } from '@/features/billing/api';
import type { PixCheckoutMeta } from '@/features/billing/handle-checkout';
import type { CheckoutResult } from '@/features/billing/types';
import { sanitizePixQrSrc } from '@/lib/safe-url';

type PixPayload = Extract<CheckoutResult, { mode: 'pix' }> & PixCheckoutMeta;

const CREDITS_BY_AMOUNT: Record<number, number> = {
  1499: 2000,
  2399: 5000,
};

function formatBrl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function isPixPaid(
  pix: PixPayload | null,
  status: { planStatus: string; plan: string; creditBalance: number; paymentProvider?: string | null } | undefined,
  baselineOverride: number | null,
): boolean {
  if (!status) return false;
  if (pix?.purpose === 'plan') {
    return status.planStatus === 'ACTIVE' && status.plan === 'STARTER_MONTHLY';
  }
  if (status.planStatus === 'ACTIVE' && status.plan === 'LIFETIME') return true;
  if (pix?.purpose !== 'credits') return false;
  const expected = CREDITS_BY_AMOUNT[pix.amountCentavos];
  const baseline =
    typeof pix.baselineCreditBalance === 'number' ? pix.baselineCreditBalance : baselineOverride;
  if (!expected || baseline === null) return false;
  return status.creditBalance >= baseline + expected;
}

export function PixCheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pix, setPix] = useState<PixPayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [capturedBaseline, setCapturedBaseline] = useState<number | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('prospectly.pixCheckout');
    if (!raw) {
      navigate('/credits', { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PixPayload;
      if (parsed.mode !== 'pix' || !parsed.brCode) {
        navigate('/credits', { replace: true });
        return;
      }
      setPix(parsed);
    } catch {
      navigate('/credits', { replace: true });
    }
  }, [navigate]);

  const status = useQuery({
    queryKey: ['billing', 'status', 'pix-poll'],
    queryFn: getBillingStatus,
    enabled: Boolean(pix),
    refetchInterval: (query) => {
      if (isPixPaid(pix, query.state.data, capturedBaseline)) return false;
      return 2500;
    },
  });

  useEffect(() => {
    if (
      status.data &&
      capturedBaseline === null &&
      typeof pix?.baselineCreditBalance !== 'number'
    ) {
      setCapturedBaseline(status.data.creditBalance);
    }
  }, [status.data, capturedBaseline, pix?.baselineCreditBalance]);

  const paid = isPixPaid(pix, status.data, capturedBaseline);

  useEffect(() => {
    if (!paid) return;
    sessionStorage.removeItem('prospectly.pixCheckout');
    navigate('/billing/success', { replace: true });
  }, [paid, navigate]);

  const qrSrc = useMemo(() => sanitizePixQrSrc(pix?.brCodeBase64), [pix]);

  if (!pix) {
    return null;
  }

  const creditsAmount = CREDITS_BY_AMOUNT[pix.amountCentavos];
  const priceFormatted = formatBrl(pix.amountCentavos);
  const creditsSuffix = creditsAmount
    ? ` · ${creditsAmount.toLocaleString('pt-BR')} créditos`
    : '';

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

      {/* Main Content */}
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center text-center py-8">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-display text-[color:var(--ink)]">
          Pague com PIX
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-secondary)] max-w-md">
          {`Escaneie o QR Code ou copie o código. Valor: ${priceFormatted}${creditsSuffix}`}
        </p>

        {/* Card matching 06-cobranca-pix.png */}
        <section className="mt-8 w-full rounded-panel border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-6 sm:p-8 shadow-card space-y-6 text-left">
          {/* QR code */}
          {qrSrc ? (
            <div className="flex justify-center">
              <img
                src={qrSrc}
                alt={t('billing.pixQrAlt', { defaultValue: 'QR Code Pix' })}
                className="h-56 w-56 sm:h-64 sm:w-64 rounded-card border border-[color:var(--border-default)] bg-white p-4 object-contain shadow-sm"
              />
            </div>
          ) : null}

          {/* Copia e Cola */}
          <div className="space-y-2">
            <MonoLabel>PIX COPIA E COLA</MonoLabel>
            <div className="relative">
              <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-3 font-mono text-xs text-[color:var(--ink)] truncate select-all">
                {pix.brCode}
              </div>
            </div>

            <Button
              type="button"
              className="w-full rounded-full py-3 shadow-soft font-semibold"
              onClick={async () => {
                await navigator.clipboard.writeText(pix.brCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Código copiado!' : 'Copiar código'}
            </Button>
          </div>

          {/* Polling indicator */}
          <div className="flex items-center justify-center gap-2 pt-1" role="status">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D4F56A] animate-pulse" />
            <span className="text-xs font-medium text-[color:var(--ink-secondary)]">
              Aguardando confirmação do pagamento...
            </span>
          </div>

          {/* Back/Cancel */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              aria-label="Voltar"
              onClick={() => navigate('/credits')}
              className="text-xs text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)] hover:underline"
            >
              Cancelar e voltar
            </button>
          </div>
        </section>
      </main>

      {/* Footer spacer */}
      <div className="h-6" aria-hidden="true" />
    </div>
  );
}
