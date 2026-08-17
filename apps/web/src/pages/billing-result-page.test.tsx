import { act, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { saveCheckoutIntent } from '@/features/billing/checkout-intent';
import { renderWithProviders } from '@/test/render';
import { BILLING_SUCCESS_TIMEOUT_MS, BillingSuccessPage } from './billing-result-page';

const getBillingStatus = vi.fn();

vi.mock('@/features/billing/api', () => ({
  getBillingStatus: (...args: unknown[]) => getBillingStatus(...args),
}));

const unpaidStatus = {
  plan: 'FREE' as const,
  planStatus: 'INACTIVE' as const,
  paymentProvider: null,
  creditBalance: 400,
  searchUsage: { used: 0, limit: 3, remaining: 3, unlimited: false },
  planCurrency: null,
  currentPeriodEnd: null,
  legacyStripeSubscription: false,
  canOpenPortal: false,
  canCancelSubscription: false,
  canExportCsv: false,
  freeSearchLimit: 3,
};

describe('BillingSuccessPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    sessionStorage.clear();
    getBillingStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not claim confirmation immediately', async () => {
    saveCheckoutIntent({
      purpose: 'credits',
      offer: 'credits-2000',
      baselineCreditBalance: 400,
      provider: 'ABACATE',
    });
    getBillingStatus.mockResolvedValue(unpaidStatus);

    renderWithProviders(<BillingSuccessPage />, { initialEntries: ['/billing/success'] });
    expect(await screen.findByRole('heading', { name: 'Confirmando pagamento' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pagamento confirmado' })).not.toBeInTheDocument();
  });

  it('confirms credits after polling sees the new balance', async () => {
    saveCheckoutIntent({
      purpose: 'credits',
      offer: 'credits-2000',
      baselineCreditBalance: 400,
      provider: 'ABACATE',
    });
    getBillingStatus.mockResolvedValue({
      plan: 'FREE',
      planStatus: 'INACTIVE',
      paymentProvider: 'ABACATE',
      creditBalance: 2400,
      searchUsage: { used: 0, limit: 3, remaining: 3, unlimited: false },
      planCurrency: null,
      currentPeriodEnd: null,
      legacyStripeSubscription: false,
      canOpenPortal: false,
      canCancelSubscription: false,
      canExportCsv: false,
      freeSearchLimit: 3,
    });

    renderWithProviders(<BillingSuccessPage />, { initialEntries: ['/billing/success'] });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pagamento confirmado' })).toBeInTheDocument();
    });
  });

  it('confirms the monthly plan after polling', async () => {
    saveCheckoutIntent({ purpose: 'plan', plan: 'monthly', provider: 'ABACATE' });
    getBillingStatus.mockResolvedValue({
      plan: 'STARTER_MONTHLY',
      planStatus: 'ACTIVE',
      paymentProvider: 'ABACATE',
      creditBalance: 400,
      searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
      planCurrency: 'BRL',
      currentPeriodEnd: null,
      legacyStripeSubscription: false,
      canOpenPortal: false,
      canCancelSubscription: true,
      canExportCsv: true,
      freeSearchLimit: 3,
    });

    renderWithProviders(<BillingSuccessPage />, { initialEntries: ['/billing/success'] });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Pagamento confirmado' })).toBeInTheDocument();
    });
  });

  it('shows delayed state after the confirmation timeout', async () => {
    vi.useFakeTimers();
    saveCheckoutIntent({
      purpose: 'credits',
      offer: 'credits-2000',
      baselineCreditBalance: 400,
      provider: 'ABACATE',
    });
    getBillingStatus.mockResolvedValue(unpaidStatus);

    renderWithProviders(<BillingSuccessPage />, { initialEntries: ['/billing/success'] });
    expect(screen.getByRole('heading', { name: 'Confirmando pagamento' })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BILLING_SUCCESS_TIMEOUT_MS);
    });

    expect(screen.getByRole('heading', { name: 'Ainda estamos confirmando' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Está demorando mais que o esperado. Volte aos créditos e atualize em instantes.',
    );
  });

  it('shows error state when billing status fails', async () => {
    saveCheckoutIntent({
      purpose: 'credits',
      offer: 'credits-2000',
      baselineCreditBalance: 400,
      provider: 'ABACATE',
    });
    getBillingStatus.mockRejectedValue(new Error('status failed'));

    renderWithProviders(<BillingSuccessPage />, { initialEntries: ['/billing/success'] });
    expect(await screen.findByRole('heading', { name: 'Não foi possível consultar o status' })).toBeInTheDocument();
  });
});
