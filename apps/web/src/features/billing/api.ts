import { api } from '@/lib/api';

import type { BillingStatus, CheckoutResult, CreditOffer } from './types';

export type BillingProfile = {
  organizationId: string;
  name: string;
  cpfCnpj: string;
  phone: string;
  email: string;
  asaasCustomerId: string | null;
};

export async function getBillingProfile(): Promise<BillingProfile | null> {
  const { data } = await api.get<BillingProfile | null>('/billing/profile');
  return data;
}

export async function updateBillingProfile(
  input: Pick<BillingProfile, 'name' | 'cpfCnpj' | 'phone' | 'email'>,
): Promise<BillingProfile> {
  const { data } = await api.put<BillingProfile>('/billing/profile', input);
  return data;
}

export async function createCheckoutSession(input: {
  interval: 'monthly' | 'lifetime';
  currency?: 'BRL';
  paymentMethod?: 'pix' | 'card';
}): Promise<CheckoutResult> {
  const { data } = await api.post<CheckoutResult>('/billing/checkout', {
    interval: input.interval,
    currency: input.currency ?? 'BRL',
    paymentMethod: input.paymentMethod ?? 'pix',
  });
  return data;
}

export async function createCreditCheckout(input: {
  offer: CreditOffer;
  paymentMethod?: 'pix' | 'card';
}): Promise<CheckoutResult> {
  const { data } = await api.post<CheckoutResult>('/billing/credits/checkout', {
    ...input,
    paymentMethod: input.paymentMethod ?? 'pix',
  });
  return data;
}

export async function cancelBillingSubscription(): Promise<{ canceled: true }> {
  const { data } = await api.post<{ canceled: true }>('/billing/cancel');
  return data;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const { data } = await api.get<BillingStatus>('/billing/status');
  return data;
}
