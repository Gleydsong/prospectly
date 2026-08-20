import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role, type AuthUser } from '@/types';
import { useAuthStore } from '@/stores/auth.store';
import { api, bootstrapSession } from './api';

const user: AuthUser = {
  id: 'u1',
  name: 'Ana',
  email: 'ana@example.com',
  organizationId: 'org-1',
  organizationName: 'Acme',
  role: Role.OWNER,
  locale: 'pt',
};

const originalAdapter = api.defaults.adapter;

function unauthorized(config: InternalAxiosRequestConfig): never {
  const error = new AxiosError('Unauthorized');
  error.config = config;
  error.response = {
    status: 401,
    data: { message: 'Membership revoked' },
    statusText: 'Unauthorized',
    headers: {},
    config,
  };
  throw error;
}

describe('api session interceptor', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, bootstrapped: false });
    localStorage.clear();
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null, accessToken: null, bootstrapped: false });
  });

  it('refreshes once on concurrent 401s and retries the original request', async () => {
    useAuthStore.setState({ user, accessToken: 'old-token' });
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'new-token' } });
    const seenAuth: string[] = [];

    api.defaults.adapter = (async (config) => {
      const auth = String(config.headers.Authorization ?? '');
      seenAuth.push(auth);
      if (auth !== 'Bearer new-token') {
        unauthorized(config);
      }
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    }) as AxiosAdapter;

    const [leads, billing] = await Promise.all([api.get('/leads'), api.get('/billing/status')]);

    expect(leads.data).toEqual({ ok: true });
    expect(billing.data).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0]?.[2]).toMatchObject({
      withCredentials: true,
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(useAuthStore.getState().accessToken).toBe('new-token');
    expect(seenAuth.filter((value) => value === 'Bearer new-token')).toHaveLength(2);
  });

  it('clears the session when refresh fails and does not loop', async () => {
    useAuthStore.setState({ user, accessToken: 'old-token' });
    const refresh = vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Invalid refresh token'));
    let protectedCalls = 0;

    api.defaults.adapter = (async (config) => {
      protectedCalls += 1;
      unauthorized(config);
    }) as AxiosAdapter;

    await expect(api.get('/dashboard/summary')).rejects.toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(protectedCalls).toBe(1);
    expect(useAuthStore.getState()).toMatchObject({ user: null, accessToken: null });
  });

  it('does not refresh again when the retried request still returns 401', async () => {
    useAuthStore.setState({ user, accessToken: 'old-token' });
    const refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'new-token' } });
    let protectedCalls = 0;

    api.defaults.adapter = (async (config) => {
      protectedCalls += 1;
      unauthorized(config);
    }) as AxiosAdapter;

    await expect(api.get('/leads')).rejects.toMatchObject({ response: { status: 401 } });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(protectedCalls).toBe(2);
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('restores the access token from a valid refresh cookie on reload', async () => {
    useAuthStore.setState({ user, accessToken: null, bootstrapped: false });
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'restored-token' } });
    api.defaults.adapter = (async (config) => ({
      data: { name: user.name },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })) as AxiosAdapter;

    await expect(bootstrapSession()).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'restored-token',
      user: expect.objectContaining({ id: user.id }),
      bootstrapped: true,
    });
  });
});
