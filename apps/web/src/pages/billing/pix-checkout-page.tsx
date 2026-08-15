import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getBillingStatus } from '@/features/billing/api';
import type { PixCheckoutMeta } from '@/features/billing/handle-checkout';
import type { CheckoutResult } from '@/features/billing/types';
import { sanitizePixQrSrc } from '@/lib/safe-url';

type PixPayload = Extract<CheckoutResult, { mode: 'pix' }> & PixCheckoutMeta;

const CREDITS_BY_AMOUNT: Record<number, number> = {
  999: 2000,
  1999: 5000,
};

function formatBrl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function isPixPaid(
  pix: PixPayload | null,
  status: { planStatus: string; plan: string; creditBalance: number } | undefined,
  baselineOverride: number | null,
): boolean {
  if (!status) return false;
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

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardHeader
          title={t('billing.pixTitle')}
          description={t('billing.pixDesc', { amount: formatBrl(pix.amountCentavos) })}
        />
        <CardContent className="space-y-4">
          {qrSrc ? (
            <img
              src={qrSrc}
              alt={t('billing.pixQrAlt')}
              className="mx-auto h-56 w-56 rounded-lg border border-zinc-800 bg-zinc-900 p-2"
            />
          ) : null}

          <div className="space-y-2">
            <p className="text-sm font-medium text-zinc-100">{t('billing.pixCopyLabel')}</p>
            <textarea
              readOnly
              value={pix.brCode}
              className="h-24 w-full resize-none rounded-control border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-zinc-200"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(pix.brCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? t('billing.pixCopied') : t('billing.pixCopy')}
            </Button>
          </div>

          <p className="text-sm text-zinc-500" role="status">
            {t('billing.pixWaiting')}
          </p>

          <Button type="button" variant="ghost" onClick={() => navigate('/credits')}>
            {t('common.back')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
