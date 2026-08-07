import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { useAuthStore } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  timeout: 20_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { setAccessToken, clear } = useAuthStore.getState();
  try {
    const response = await axios.post<{ accessToken: string }>(
      `${api.defaults.baseURL}/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      },
    );
    setAccessToken(response.data.accessToken);
    return response.data.accessToken;
  } catch (error) {
    clear();
    throw error;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthEndpoint = original?.url?.includes('/auth/');
    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return api(original);
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[]; code?: string; error?: { code?: string } }
      | undefined;
    if (data?.code === 'EMAIL_NOT_VERIFIED' || data?.error?.code === 'EMAIL_NOT_VERIFIED') {
      return 'EMAIL_NOT_VERIFIED';
    }
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(', ') : data.message;
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Não foi possível contactar o servidor.';
    }
  }
  return 'Ocorreu um erro inesperado.';
}

export async function bootstrapSession(): Promise<boolean> {
  const { accessToken, user, setAuth, setBootstrapped, updateUser, clear } = useAuthStore.getState();
  if (accessToken) {
    setBootstrapped(true);
    void syncProfileAvatar(updateUser);
    return true;
  }
  if (!user) {
    setBootstrapped(true);
    return false;
  }
  try {
    const response = await axios.post<{ accessToken: string }>(
      `${api.defaults.baseURL}/auth/refresh`,
      {},
      {
        withCredentials: true,
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      },
    );
    setAuth({ user, accessToken: response.data.accessToken });
    setBootstrapped(true);
    void syncProfileAvatar(updateUser);
    return true;
  } catch {
    clear();
    setBootstrapped(true);
    return false;
  }
}

async function syncProfileAvatar(
  updateUser: (patch: Partial<{ avatarUrl?: string | null; name?: string; emailVerifiedAt?: string | null }>) => void,
): Promise<void> {
  try {
    const { data } = await api.get<{
      avatarUrl?: string | null;
      name?: string;
      emailVerifiedAt?: string | null;
    }>('/users/me');
    updateUser({
      avatarUrl: data.avatarUrl ?? null,
      ...(data.name ? { name: data.name } : {}),
      emailVerifiedAt: data.emailVerifiedAt ?? null,
    });
  } catch {
    /* ignore — avatar stays as cached */
  }
}
