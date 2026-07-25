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

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}
