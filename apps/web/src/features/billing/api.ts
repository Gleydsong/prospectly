import { api } from '@/lib/api';

import type { BillingStatus, CheckoutResult, CreditOffer, PaymentMethod } from './types';

export async function createCheckoutSession(input: {
  interval: 'monthly' | 'lifetime';
  currency?: 'BRL';
  paymentMethod: PaymentMethod;
}): Promise<CheckoutResult> {
  const { data } = await api.post<CheckoutResult>('/billing/checkout', {
    interval: input.interval,
    currency: input.currency ?? 'BRL',
    paymentMethod: input.paymentMethod,
  });
  return data;
}

export async function createCreditCheckout(input: {
  offer: CreditOffer;
  paymentMethod: PaymentMethod;
}): Promise<CheckoutResult> {
  const { data } = await api.post<CheckoutResult>('/billing/credits/checkout', input);
  return data;
}

export async function createBillingPortal(): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>('/billing/portal');
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
