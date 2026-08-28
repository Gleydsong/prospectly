import { describe, expect, it } from 'vitest';

import { billingAuthQuery } from './auth-query';
import { isCheckoutConfirmed } from './confirmation';

describe('billingAuthQuery', () => {
  it('preserves a credit offer between login and register', () => {
    expect(billingAuthQuery({ offer: 'credits-2000' })).toBe('?offer=credits-2000');
  });

  it('preserves a monthly plan between login and register', () => {
    expect(billingAuthQuery({ plan: 'monthly' })).toBe('?plan=monthly');
  });
});

describe('isCheckoutConfirmed', () => {
  it('confirms credits against baseline + pack', () => {
    expect(
      isCheckoutConfirmed(
        {
          purpose: 'credits',
          offer: 'credits-2000',
          baselineCreditBalance: 400,
          provider: 'ABACATE',
        },
        {
          plan: 'FREE',
          planStatus: 'INACTIVE',
          paymentProvider: 'ABACATE',
          creditBalance: 2400,
          searchUsage: { used: 0, limit: 3, remaining: 3, unlimited: false },
          planCurrency: null,
          currentPeriodEnd: null,
          canCancelSubscription: false,
          canExportCsv: false,
          freeSearchLimit: 3,
        },
      ),
    ).toBe(true);
  });

  it('confirms monthly plan when STARTER_MONTHLY is ACTIVE on the checkout provider', () => {
    const status = {
      plan: 'STARTER_MONTHLY' as const,
      planStatus: 'ACTIVE' as const,
      paymentProvider: 'ABACATE' as const,
      creditBalance: 400,
      searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
      planCurrency: 'BRL',
      currentPeriodEnd: null,
      canCancelSubscription: true,
      canExportCsv: true,
      freeSearchLimit: 3,
    };
    expect(
      isCheckoutConfirmed({ purpose: 'plan', plan: 'monthly', provider: 'ABACATE' }, status),
    ).toBe(true);
    expect(
      isCheckoutConfirmed(
        { purpose: 'plan', plan: 'monthly', provider: 'ASAAS' },
        { ...status, paymentProvider: 'ASAAS' },
      ),
    ).toBe(true);
    expect(
      isCheckoutConfirmed(
        { purpose: 'plan', plan: 'monthly', provider: 'ASAAS' },
        status,
      ),
    ).toBe(false);
  });
});
