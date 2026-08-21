import { AxiosError } from 'axios';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '@/i18n';
import { useAuthStore } from '@/stores/auth.store';
import { renderWithProviders } from '@/test/render';
import { CreditsPage } from './credits-page';

const createCreditCheckout = vi.fn();
const getBillingStatus = vi.fn();
const cancelBillingSubscription = vi.fn();

vi.mock('@/features/auth/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/auth/api')>('@/features/auth/api');
  return {
    ...actual,
    createCreditCheckout: (...args: unknown[]) => createCreditCheckout(...args),
    getBillingStatus: (...args: unknown[]) => getBillingStatus(...args),
    cancelBillingSubscription: (...args: unknown[]) => cancelBillingSubscription(...args),
    createBillingPortal: vi.fn(),
    createCheckoutSession: vi.fn(),
  };
});

const handleCheckoutResult = vi.fn();
vi.mock('@/features/billing/handle-checkout', () => ({
  handleCheckoutResult: (...args: unknown[]) => handleCheckoutResult(...args),
}));

describe('CreditsPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('pt');
    createCreditCheckout.mockReset();
    handleCheckoutResult.mockReset();
    cancelBillingSubscription.mockReset();
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
      monthlyCardEnabled: false,
    });
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'Ana',
        role: 'OWNER',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
        organizationId: 'org1',
        organizationName: 'Acme',
        locale: 'pt',
      } as never,
      accessToken: 'token',
      bootstrapped: true,
    });
  });

  it('sends paymentMethod card for AbacatePay checkout', async () => {
    const user = userEvent.setup();
    createCreditCheckout.mockResolvedValue({
      mode: 'redirect',
      provider: 'ABACATE',
      url: 'https://app.abacatepay.com/pay/bill_1',
    });
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click((await screen.findAllByRole('button', { name: 'Comprar créditos' }))[0]!);
    await user.click(screen.getByRole('button', { name: /Cartão via AbacatePay/ }));
    await waitFor(() => {
      expect(createCreditCheckout).toHaveBeenCalledWith({
        offer: 'credits-2000',
        paymentMethod: 'card',
      });
    });
  });

  it('shows an accessible cancel confirmation and hides Stripe portal for Abacate orgs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    expect(screen.queryByRole('button', { name: 'Portal legado do cartão (Stripe)' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    expect(await screen.findByRole('dialog', { name: 'Cancelar assinatura AbacatePay?' })).toBeInTheDocument();
    expect(screen.getByText(/O cancelamento é imediato/)).toBeInTheDocument();
  });

  it('shows the legacy Stripe portal only for Stripe orgs', async () => {
    getBillingStatus.mockResolvedValue({
      plan: 'STARTER_MONTHLY',
      planStatus: 'ACTIVE',
      paymentProvider: 'STRIPE',
      creditBalance: 400,
      searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
      planCurrency: 'BRL',
      currentPeriodEnd: null,
      legacyStripeSubscription: true,
      canOpenPortal: true,
      canCancelSubscription: false,
      canExportCsv: true,
      freeSearchLimit: 3,
      monthlyCardEnabled: false,
    });
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    expect(
      await screen.findByRole('button', { name: 'Portal legado do cartão (Stripe)' }),
    ).toBeInTheDocument();
  });

  it('keeps unlimited card disabled until the monthly product exists', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click(await screen.findByRole('button', { name: 'Assinar ilimitado' }));
    const card = screen.getByRole('button', { name: /Cartão via AbacatePay/ });
    expect(card).toBeDisabled();
    expect(screen.getByText(/Cartão do Ilimitado ainda não está no catálogo de teste/)).toBeInTheDocument();
  });

  it('surfaces the API checkout error instead of a generic billing message', async () => {
    const user = userEvent.setup();
    const error = new AxiosError('fail');
    error.response = {
      status: 503,
      data: { message: 'AbacatePay is not configured' },
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
    };
    createCreditCheckout.mockRejectedValue(error);

    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click((await screen.findAllByRole('button', { name: 'Comprar créditos' }))[0]!);
    await user.click(screen.getByRole('button', { name: /^PIX/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AbacatePay is not configured');
  });

  it('does not treat a missing role as read-only while the profile hydrates', () => {
    useAuthStore.setState((state) => ({
      ...state,
      user: state.user ? { ...state.user, role: undefined as never } : state.user,
    }));
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    expect(screen.queryByText(/Apenas proprietários/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comprar créditos' })).not.toBeInTheDocument();
  });
});
