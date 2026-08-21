import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Role, type AuthUser } from '@/types';
import { persistableUser, useAuthStore } from '@/stores/auth.store';
import { api, bootstrapSession, getApiErrorMessage } from './api';

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
    useAuthStore.setState({
      user: persistableUser(user) as AuthUser,
      accessToken: null,
      bootstrapped: false,
    });
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'restored-token' } });
    api.defaults.adapter = (async (config) => ({
      data: {
        name: user.name,
        emailVerifiedAt: '2026-08-01T00:00:00.000Z',
        memberships: [
          {
            role: Role.OWNER,
            organization: { id: user.organizationId, name: user.organizationName },
          },
        ],
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    })) as AxiosAdapter;

    await expect(bootstrapSession()).resolves.toBe(true);
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'restored-token',
      user: expect.objectContaining({
        id: user.id,
        role: Role.OWNER,
        emailVerifiedAt: '2026-08-01T00:00:00.000Z',
      }),
      bootstrapped: true,
    });
  });
});

describe('getApiErrorMessage', () => {
  it('surfaces the API message from checkout and search failures', () => {
    const error = new AxiosError('fail');
    error.response = {
      status: 503,
      data: { message: 'AbacatePay is not configured' },
      statusText: 'Service Unavailable',
      headers: {},
      config: {} as never,
    };
    expect(getApiErrorMessage(error)).toBe('AbacatePay is not configured');
  });

  it('maps request timeouts instead of a generic unexpected error', () => {
    const error = new AxiosError('timeout', 'ECONNABORTED');
    expect(getApiErrorMessage(error)).toBe('O servidor demorou para responder. Tente novamente.');
  });
});
