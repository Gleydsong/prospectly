import { AxiosError } from 'axios';
import { screen } from '@testing-library/react';
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

vi.mock('@/features/billing/billing-profile-form', () => ({
  BillingProfileForm: () => <div>Perfil de cobrança</div>,
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
      paymentProvider: 'ASAAS',
      creditBalance: 400,
      searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
      planCurrency: 'BRL',
      currentPeriodEnd: null,
      canCancelSubscription: true,
      canExportCsv: true,
      freeSearchLimit: 3,
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

  it('starts a PIX credit checkout directly', async () => {
    const user = userEvent.setup();
    createCreditCheckout.mockResolvedValue({
      mode: 'redirect',
      provider: 'ASAAS',
      url: 'https://sandbox.asaas.com/i/bill_1',
    });
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click((await screen.findAllByRole('button', { name: 'Pagar com Pix' }))[0]!);
    expect(createCreditCheckout).toHaveBeenCalledWith({
      offer: 'credits-2000',
      paymentMethod: 'pix',
    });
  });

  it('lets the payer switch from PIX to card without a checkout lock toast', async () => {
    const user = userEvent.setup();
    createCreditCheckout
      .mockResolvedValueOnce({
        mode: 'pix',
        provider: 'ASAAS',
        brCode: '000201',
        brCodeBase64: 'cG5n',
        externalPaymentId: 'pay_pix_1',
        amountCentavos: 1499,
      })
      .mockResolvedValueOnce({
        mode: 'redirect',
        provider: 'ASAAS',
        url: 'https://sandbox.asaas.com/i/pay_card_1',
      });
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click((await screen.findAllByRole('button', { name: 'Pagar com Pix' }))[0]!);
    await user.click(
      (await screen.findAllByRole('button', { name: 'Cartão de crédito ou débito' }))[0]!,
    );
    expect(createCreditCheckout).toHaveBeenNthCalledWith(2, {
      offer: 'credits-2000',
      paymentMethod: 'card',
    });
    expect(screen.queryByText(/Estamos confirmando seu checkout/)).not.toBeInTheDocument();
  });

  it('offers the Asaas hosted card method for credit packages', async () => {
    const user = userEvent.setup();
    createCreditCheckout.mockResolvedValue({
      mode: 'redirect',
      provider: 'ASAAS',
      url: 'https://sandbox.asaas.com/i/pay_1',
    });
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click(
      (await screen.findAllByRole('button', { name: 'Cartão de crédito ou débito' }))[0]!,
    );
    expect(createCreditCheckout).toHaveBeenCalledWith({
      offer: 'credits-2000',
      paymentMethod: 'card',
    });
  });

  it('keeps checkout controls blocked after reload while provider confirmation is pending', async () => {
    getBillingStatus.mockResolvedValue({
      plan: 'FREE',
      planStatus: 'INACTIVE',
      paymentProvider: null,
      creditBalance: 400,
      searchUsage: { used: 0, limit: 3, remaining: 3, unlimited: false },
      planCurrency: null,
      currentPeriodEnd: null,
      canCancelSubscription: false,
      canExportCsv: false,
      freeSearchLimit: 3,
      checkoutReviewRequired: true,
    });

    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });

    expect(await screen.findByText(/Estamos confirmando seu checkout/)).toBeInTheDocument();
    expect((await screen.findAllByRole('button', { name: 'Pagar com Pix' }))[0]).toBeDisabled();
    expect(
      (await screen.findAllByRole('button', { name: 'Cartão de crédito ou débito' }))[0],
    ).toBeDisabled();
  });

  it('shows an accessible cancel confirmation and hides Stripe portal for Asaas orgs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    expect(
      screen.queryByRole('button', { name: 'Portal legado do cartão (Stripe)' }),
    ).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Cancelar assinatura' }));
    expect(await screen.findByRole('dialog', { name: 'Cancelar assinatura?' })).toBeInTheDocument();
    expect(screen.getByText(/O cancelamento é imediato/)).toBeInTheDocument();
  });

  it('does not expose a Stripe portal for historical Stripe rows', async () => {
    getBillingStatus.mockResolvedValue({
      plan: 'STARTER_MONTHLY',
      planStatus: 'ACTIVE',
      paymentProvider: 'STRIPE',
      creditBalance: 400,
      searchUsage: { used: 0, limit: null, remaining: null, unlimited: true },
      planCurrency: 'BRL',
      currentPeriodEnd: null,
      canCancelSubscription: false,
      canExportCsv: true,
      freeSearchLimit: 3,
    });
    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    expect(await screen.findByText('Créditos disponíveis')).toBeInTheDocument();
    expect(screen.queryByText(/Stripe/)).not.toBeInTheDocument();
  });

  it('surfaces the API checkout error instead of a generic billing message', async () => {
    const user = userEvent.setup();
    const error = new AxiosError('fail');
    error.response = {
      status: 503,
      data: { message: 'Asaas is not configured' },
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
    };
    createCreditCheckout.mockRejectedValue(error);

    renderWithProviders(<CreditsPage />, { initialEntries: ['/credits'] });
    await user.click((await screen.findAllByRole('button', { name: 'Pagar com Pix' }))[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent('Asaas is not configured');
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
