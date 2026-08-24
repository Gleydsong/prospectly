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

export type AppmaxCardCheckoutInput = {
  checkoutKey: string;
  purpose: 'monthly' | 'credits';
  offer?: CreditOffer;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  ip: string;
  cardToken: string;
  documentNumber: string;
  holderName: string;
};

export async function createAppmaxCardCheckout(input: AppmaxCardCheckoutInput): Promise<CheckoutResult> {
  const { data } = await api.post<CheckoutResult>('/billing/card/checkout', input);
  return data;
}

export async function getAppmaxCardConfig(): Promise<{ externalId: string; scriptUrl: string }> {
  const { data } = await api.get<{ externalId: string; scriptUrl: string }>('/billing/card/config');
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
