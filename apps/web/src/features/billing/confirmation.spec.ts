import { describe, expect, it } from 'vitest';

import { billingAuthQuery } from './auth-query';
import { isCheckoutConfirmed } from './confirmation';

describe('billingAuthQuery', () => {
  it('preserves offer and card method between login and register', () => {
    expect(billingAuthQuery({ offer: 'credits-2000', method: 'card' })).toBe(
      '?offer=credits-2000&method=card',
    );
  });

  it('does not drop method when a plan is present', () => {
    expect(billingAuthQuery({ plan: 'monthly', method: 'card' })).toBe('?plan=monthly&method=card');
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
          monthlyCardEnabled: false,
          cardEnabled: false,
        },
      ),
    ).toBe(true);
  });

  it('confirms monthly plan only when STARTER_MONTHLY is ACTIVE on AbacatePay', () => {
    expect(
      isCheckoutConfirmed(
        { purpose: 'plan', plan: 'monthly', provider: 'ABACATE' },
        {
          plan: 'STARTER_MONTHLY',
          planStatus: 'ACTIVE',
          paymentProvider: 'ABACATE',
          creditBalance: 400,
          searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
          planCurrency: 'BRL',
          currentPeriodEnd: null,
          canCancelSubscription: true,
          canExportCsv: true,
          freeSearchLimit: 3,
          monthlyCardEnabled: false,
          cardEnabled: false,
        },
      ),
    ).toBe(true);
  });

  it('confirms an active Appmax monthly plan after reconciliation', () => {
    expect(
      isCheckoutConfirmed(
        { purpose: 'plan', plan: 'monthly', provider: 'APPMAX' },
        {
          plan: 'STARTER_MONTHLY',
          planStatus: 'ACTIVE',
          paymentProvider: 'APPMAX',
          creditBalance: 400,
          searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
          planCurrency: 'BRL',
          currentPeriodEnd: '2026-09-24T00:00:00.000Z',
          canCancelSubscription: true,
          canExportCsv: true,
          freeSearchLimit: 3,
          monthlyCardEnabled: true,
          cardEnabled: true,
        },
      ),
    ).toBe(true);
  });
});
