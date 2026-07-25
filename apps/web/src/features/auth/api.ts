import { api } from '@/lib/api';
import type { AuthUser } from '@/types';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', input);
  return data;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  locale: 'pt' | 'en';
  acceptTerms: true;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', input);
  return data;
}

export async function updateProfile(input: {
  name?: string;
  avatarUrl?: string;
  locale?: 'pt' | 'en';
}): Promise<{ id: string; name: string; email: string; avatarUrl?: string | null; locale: 'pt' | 'en' }> {
  const { data } = await api.patch('/users/me', input);
  return data;
}

export async function createCheckoutSession(input: {
  interval: 'monthly' | 'lifetime';
  currency: 'BRL' | 'EUR' | 'USD';
}): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>('/billing/checkout', input);
  return data;
}

export async function createBillingPortal(): Promise<{ url: string }> {
  const { data } = await api.post<{ url: string }>('/billing/portal');
  return data;
}

export async function getBillingStatus(): Promise<{
  plan: string;
  planStatus: string;
  planCurrency: string | null;
  currentPeriodEnd: string | null;
  freeSearchLimit: number;
}> {
  const { data } = await api.get<{
    plan: string;
    planStatus: string;
    planCurrency: string | null;
    currentPeriodEnd: string | null;
    freeSearchLimit: number;
  }>('/billing/status');
  return data;
}

export async function requestDataDeletion(notes?: string): Promise<{ id: string; status: string }> {
  const { data } = await api.post<{ id: string; status: string }>('/users/me/data-requests', {
    type: 'DELETE',
    notes,
  });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}
