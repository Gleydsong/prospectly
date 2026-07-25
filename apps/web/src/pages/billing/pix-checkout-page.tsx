import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getBillingStatus } from '@/features/billing/api';
import type { CheckoutResult } from '@/features/billing/types';

type PixPayload = Extract<CheckoutResult, { mode: 'pix' }>;

function formatBrl(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function PixCheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pix, setPix] = useState<PixPayload | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('prospectly.pixCheckout');
    if (!raw) {
      navigate('/settings', { replace: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as PixPayload;
      if (parsed.mode !== 'pix' || !parsed.brCode) {
        navigate('/settings', { replace: true });
        return;
      }
      setPix(parsed);
    } catch {
      navigate('/settings', { replace: true });
    }
  }, [navigate]);

  const status = useQuery({
    queryKey: ['billing', 'status', 'pix-poll'],
    queryFn: getBillingStatus,
    enabled: Boolean(pix),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.planStatus === 'ACTIVE' && data.plan === 'LIFETIME') return false;
      return 2500;
    },
  });

  const paid = status.data?.planStatus === 'ACTIVE' && status.data.plan === 'LIFETIME';

  useEffect(() => {
    if (!paid) return;
    sessionStorage.removeItem('prospectly.pixCheckout');
    navigate('/billing/success', { replace: true });
  }, [paid, navigate]);

  const qrSrc = useMemo(() => {
    if (!pix?.brCodeBase64) return null;
    return pix.brCodeBase64.startsWith('data:')
      ? pix.brCodeBase64
      : `data:image/png;base64,${pix.brCodeBase64}`;
  }, [pix]);

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

          <Button type="button" variant="ghost" onClick={() => navigate('/settings')}>
            {t('common.back')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
