import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-card)] p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">{t(`billing.successTitle.${state}`)}</h1>
        <p className="mt-3 text-sm text-[color:var(--ink-muted)]" role="status">
          {t(`billing.successBody.${state}`)}
        </p>
        <Link to="/credits" className="mt-6 inline-block" onClick={() => clearCheckoutIntent()}>
          <Button type="button">{t('billing.backToCredits')}</Button>
        </Link>
      </div>
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
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-card)] p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">{t('billing.cancelTitle')}</h1>
        <p className="mt-3 text-sm text-[color:var(--ink-muted)]">{t('billing.cancelBody')}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/credits">
            <Button type="button">{t('billing.tryAgain')}</Button>
          </Link>
          <Link to="/">
            <Button type="button" variant="secondary">
              {t('billing.backToApp')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
