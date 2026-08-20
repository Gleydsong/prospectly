import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { REFRESH_COOKIE_NAME } from '../../common/auth/refresh-cookie';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

const user = {
  id: 'user-1',
  name: 'Ana',
  email: 'ana@example.com',
  organizationId: 'org-1',
  organizationName: 'Acme',
  role: 'OWNER' as const,
  locale: 'pt' as const,
};

function makeConfig(values: Record<string, string>) {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

function makeRes() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const cleared: Array<{ name: string; options: Record<string, unknown> }> = [];
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      cookies.push({ name, value, options });
    },
    clearCookie: (name: string, options: Record<string, unknown>) => {
      cleared.push({ name, options });
    },
  } as unknown as Response;
  return { res, cookies, cleared };
}

describe('AuthController cookie refresh', () => {
  const auth = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets a local HTTP-compatible refresh cookie', async () => {
    auth.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      user,
    });
    const { res, cookies } = makeRes();
    const controller = new AuthController(
      auth as unknown as AuthService,
      makeConfig({ nodeEnv: 'development', 'jwt.refreshExpiresIn': '7d' }),
    );

    await controller.login({ email: user.email, password: 'secret1' }, res);

    expect(cookies[0]).toMatchObject({
      name: REFRESH_COOKIE_NAME,
      value: 'refresh',
      options: { httpOnly: true, secure: false, sameSite: 'lax', path: '/api/v1/auth' },
    });
  });

  it('sets a Secure SameSite=None cookie in production', async () => {
    auth.login.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      user,
    });
    const { res, cookies } = makeRes();
    const controller = new AuthController(
      auth as unknown as AuthService,
      makeConfig({
        nodeEnv: 'production',
        'jwt.refreshExpiresIn': '7d',
        'refreshCookie.sameSite': 'none',
      }),
    );

    await controller.login({ email: user.email, password: 'secret1' }, res);

    expect(cookies[0]).toMatchObject({
      name: REFRESH_COOKIE_NAME,
      options: { httpOnly: true, secure: true, sameSite: 'none', path: '/api/v1/auth' },
    });
  });

  it('rejects refresh without a cookie or body token', async () => {
    const controller = new AuthController(
      auth as unknown as AuthService,
      makeConfig({ nodeEnv: 'production' }),
    );
    const { res } = makeRes();

    await expect(
      controller.refresh({ headers: {} } as never, {}, res, '127.0.0.1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('rejects a cookie refresh without the CSRF header', async () => {
    const controller = new AuthController(
      auth as unknown as AuthService,
      makeConfig({ nodeEnv: 'production' }),
    );
    const { res } = makeRes();

    await expect(
      controller.refresh(
        { headers: { cookie: `${REFRESH_COOKIE_NAME}=refresh-token` } } as never,
        {},
        res,
        '127.0.0.1',
      ),
    ).rejects.toThrow('Missing CSRF header');
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('rotates the cookie when refresh receives cookie and CSRF header', async () => {
    auth.refresh.mockResolvedValue({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    const controller = new AuthController(
      auth as unknown as AuthService,
      makeConfig({
        nodeEnv: 'production',
        'jwt.refreshExpiresIn': '7d',
        'refreshCookie.sameSite': 'none',
      }),
    );
    const { res, cookies } = makeRes();

    const result = await controller.refresh(
      {
        headers: {
          cookie: `${REFRESH_COOKIE_NAME}=refresh-token`,
          'x-requested-with': 'XMLHttpRequest',
        },
      } as never,
      {},
      res,
      '127.0.0.1',
      'vitest',
    );

    expect(result).toEqual({ accessToken: 'next-access' });
    expect(auth.refresh).toHaveBeenCalledWith('refresh-token', {
      ip: '127.0.0.1',
      userAgent: 'vitest',
    });
    expect(cookies[0]).toMatchObject({
      value: 'next-refresh',
      options: { httpOnly: true, secure: true, sameSite: 'none', path: '/api/v1/auth' },
    });
  });

  it('clears the cookie with the same attributes used to set it', async () => {
    const controller = new AuthController(
      auth as unknown as AuthService,
      makeConfig({
        nodeEnv: 'production',
        'refreshCookie.sameSite': 'none',
      }),
    );
    const { res, cleared } = makeRes();

    await controller.logout(
      {
        headers: {
          cookie: `${REFRESH_COOKIE_NAME}=refresh-token`,
          'x-requested-with': 'XMLHttpRequest',
        },
      } as never,
      {},
      res,
    );

    expect(cleared[0]).toEqual({
      name: REFRESH_COOKIE_NAME,
      options: { httpOnly: true, secure: true, sameSite: 'none', path: '/api/v1/auth' },
    });
  });
});
