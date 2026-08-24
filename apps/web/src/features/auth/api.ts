import { api, AUTH_REQUEST_TIMEOUT_MS } from '@/lib/api';
import type { AuthUser } from '@/types';

const authRequestConfig = { timeout: AUTH_REQUEST_TIMEOUT_MS };

export type { BillingStatus, CheckoutResult } from '@/features/billing/types';
export {
  cancelBillingSubscription,
  createAppmaxCardCheckout,
  createCheckoutSession,
  createCreditCheckout,
  getBillingStatus,
  getAppmaxCardConfig,
} from '@/features/billing/api';

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export async function login(input: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', input, authRequestConfig);
  return data;
}

export async function googleAuth(input: {
  idToken?: string;
  accessToken?: string;
  organizationName?: string;
  locale?: 'pt' | 'en';
  acceptTerms?: true;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/google', input, authRequestConfig);
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
  const { data } = await api.post<AuthResponse>('/auth/register', input, authRequestConfig);
  return data;
}

export async function updateProfile(input: {
  name?: string;
  avatarUrl?: string;
  locale?: 'pt' | 'en';
}): Promise<{
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale: 'pt' | 'en';
}> {
  const { data } = await api.patch('/users/me', input);
  return data;
}

export async function changeEmail(input: {
  newEmail: string;
  currentPassword: string;
}): Promise<{ message: string }> {
  const { data } = await api.patch<{ message: string }>('/users/me/email', input);
  return data;
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token }, authRequestConfig);
}

export async function resendVerification(): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    '/auth/resend-verification',
    undefined,
    authRequestConfig,
  );
  return data;
}

export async function getProfile(): Promise<{
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  locale: 'pt' | 'en';
  emailVerifiedAt?: string | null;
}> {
  const { data } = await api.get('/users/me');
  return data;
}

export async function requestDataDeletion(notes?: string): Promise<{ id: string; status: string }> {
  const { data } = await api.post<{ id: string; status: string }>('/users/me/data-requests', {
    type: 'DELETE',
    notes,
  });
  return data;
}

export async function requestDataExport(notes?: string): Promise<{ id: string; status: string }> {
  const { data } = await api.post<{ id: string; status: string }>('/users/me/data-requests', {
    type: 'EXPORT',
    notes,
  });
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout', {}, authRequestConfig);
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>(
    '/auth/forgot-password',
    { email },
    authRequestConfig,
  );
  return data;
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  await api.post('/auth/reset-password', input, authRequestConfig);
}
