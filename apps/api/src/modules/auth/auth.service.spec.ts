import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

import type { MailService } from '../../common/mail/mail.service';
import type { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  verify: jest.fn(),
}));

const verifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken,
  })),
}));

const makePrisma = () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
    },
    organizationMember: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    pipeline: { create: jest.fn() },
    pipelineStage: { createMany: jest.fn() },
    refreshToken: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return prisma as unknown as PrismaService & {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    organizationMember: { findUnique: jest.Mock; findMany: jest.Mock };
    refreshToken: { updateMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
};

const makeConfig = (extra: Record<string, string> = {}) =>
  ({
    get: (key: string) =>
      ({
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
        'google.clientId': 'google-client-id.apps.googleusercontent.com',
        nodeEnv: 'test',
        ...extra,
      })[key],
    getOrThrow: (key: string) => `secret-for-${key}`,
  }) as unknown as ConfigService;

const makeJwt = () =>
  ({
    signAsync: jest.fn().mockResolvedValue('token'),
    verifyAsync: jest.fn(),
    decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 600, jti: 'jti-1' }),
  }) as unknown as JwtService;

const makeMail = (overrides: Partial<{ send: jest.Mock; isConfigured: jest.Mock }> = {}) =>
  ({
    send: overrides.send ?? jest.fn().mockResolvedValue(undefined),
    isConfigured: overrides.isConfigured ?? jest.fn().mockReturnValue(true),
  }) as unknown as MailService;

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('register rejects duplicated email with generic message', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@agency.dev',
        password: 'Passw0rd!',
        organizationName: 'Agency',
        locale: 'pt',
        acceptTerms: true,
      }),
    ).rejects.toMatchObject({
      message: 'Unable to complete registration with the provided data',
    });
  });

  it('register persists locale on the user', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const createdUser = {
      id: 'u1',
      email: 'ana@agency.dev',
      name: 'Ana',
      locale: 'en' as const,
    };
    const orgFindUnique = jest.fn().mockResolvedValue(null);
    const userCreate = jest.fn().mockResolvedValue(createdUser);
    const orgCreate = jest.fn().mockResolvedValue({ id: 'org1', name: 'Agency', slug: 'agency' });
    const memberCreate = jest.fn().mockResolvedValue({
      userId: 'u1',
      organizationId: 'org1',
      role: 'OWNER',
    });
    const pipelineCreate = jest.fn().mockResolvedValue({ id: 'p1' });
    const stageCreateMany = jest.fn().mockResolvedValue({ count: 10 });

    (prisma.organization as unknown as { findUnique: jest.Mock }).findUnique = orgFindUnique;
    (prisma.organization as unknown as { create: jest.Mock }).create = orgCreate;
    (prisma.user as unknown as { create: jest.Mock }).create = userCreate;
    (prisma.organizationMember as unknown as { create: jest.Mock }).create = memberCreate;
    (prisma.pipeline as unknown as { create: jest.Mock }).create = pipelineCreate;
    (prisma.pipelineStage as unknown as { createMany: jest.Mock }).createMany = stageCreateMany;

    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    (prisma.organization as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'org1', name: 'Agency' });
    (prisma.user as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(createdUser);
    (prisma.refreshToken as unknown as { create: jest.Mock }).create = jest.fn().mockResolvedValue({});

    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());
    const result = await service.register({
      name: 'Ana',
      email: 'ana@agency.dev',
      password: 'Passw0rd!',
      organizationName: 'Agency',
      locale: 'en',
      acceptTerms: true,
    });

    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ locale: 'en' }),
      }),
    );
    expect(result.user.locale).toBe('en');
  });

  it('login fails with unknown email using generic message', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await expect(
      service.login({ email: 'no@user.dev', password: 'whatever1' }),
    ).rejects.toMatchObject({ message: 'Invalid credentials' });
  });

  it('login increments failed attempts and locks account', async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(false);
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.dev',
      passwordHash: 'hash',
      failedLoginAttempts: 4,
      lockedUntil: null,
      memberships: [{ organizationId: 'org1', role: 'OWNER' }],
    });
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await expect(service.login({ email: 'a@b.dev', password: 'wrong1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ failedLoginAttempts: 5 }),
      }),
    );
  });

  it('login succeeds and resets failed attempts', async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.dev',
      name: 'Ana',
      passwordHash: 'hash',
      failedLoginAttempts: 2,
      lockedUntil: null,
      locale: 'pt',
      memberships: [{ organizationId: 'org1', role: 'OWNER' }],
    });
    prisma.organization.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'org1', name: 'Org' });
    prisma.refreshToken.create = jest.fn().mockResolvedValue({});
    (prisma.user as unknown as Record<string, jest.Mock>).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'a@b.dev', locale: 'pt' });

    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());
    const result = await service.login({ email: 'a@b.dev', password: 'RightPass1' });

    expect(result.user.organizationId).toBe('org1');
    expect(result.user.locale).toBe('pt');
    expect(result.accessToken).toBe('token');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { failedLoginAttempts: 0, lockedUntil: null } }),
    );
  });

  it('refresh rejects revoked token', async () => {
    const jwt = makeJwt();
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', jti: 'jti-1' });
    const prisma = makePrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
      id: 'jti-1',
      tokenHash: 'hash',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
      replacedById: null,
      organizationId: 'org1',
    });
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const service = new AuthService(prisma, jwt, makeConfig(), makeMail());
    await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('refresh reuse of rotated token outside grace revokes all sessions', async () => {
    const jwt = makeJwt();
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', jti: 'jti-1' });
    const prisma = makePrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
      id: 'jti-1',
      tokenHash: 'hash',
      revokedAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() + 10000),
      replacedById: 'jti-2',
      organizationId: 'org1',
    });
    prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 2 });
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const service = new AuthService(prisma, jwt, makeConfig(), makeMail());
    await expect(service.refresh('reused-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('refresh concurrent reuse within grace issues tokens without logoutAll', async () => {
    const jwt = makeJwt();
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', jti: 'jti-1' });
    (jwt.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token-new');
    (jwt.decode as jest.Mock).mockReturnValue({
      exp: Math.floor(Date.now() / 1000) + 600,
      jti: 'jti-3',
    });
    const prisma = makePrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
      id: 'jti-1',
      tokenHash: 'hash',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
      replacedById: 'jti-2',
      organizationId: 'org1',
    });
    prisma.organizationMember.findUnique = jest.fn().mockResolvedValue({
      userId: 'u1',
      organizationId: 'org1',
      role: 'OWNER',
    });
    (prisma.user as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'a@b.dev' });
    prisma.refreshToken.create = jest.fn().mockResolvedValue({});
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const service = new AuthService(prisma, jwt, makeConfig(), makeMail());
    const tokens = await service.refresh('concurrent-token');

    expect(tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token-new',
    });
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
      }),
    );
  });

  it('refresh rejects legacy token without organizationId for a multi-org user', async () => {
    const jwt = makeJwt();
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', jti: 'jti-1' });
    const prisma = makePrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
      id: 'jti-1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
      replacedById: null,
      organizationId: null,
    });
    prisma.organizationMember.findMany = jest.fn().mockResolvedValue([
      { userId: 'u1', organizationId: 'org-a', role: 'OWNER' },
      { userId: 'u1', organizationId: 'org-b', role: 'MEMBER' },
    ]);
    (argon2.verify as jest.Mock).mockResolvedValue(true);

    const service = new AuthService(prisma, jwt, makeConfig(), makeMail());

    await expect(service.refresh('legacy-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('googleAuth creates owner account like register when new Google user', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'nova@agency.dev',
        email_verified: true,
        name: 'Nova User',
      }),
    });

    const prisma = makePrisma();
    prisma.user.findUnique
      .mockResolvedValueOnce(null) // by googleId
      .mockResolvedValueOnce(null); // by email

    const createdUser = {
      id: 'u-google',
      email: 'nova@agency.dev',
      name: 'Nova User',
      locale: 'pt' as const,
      googleId: 'google-sub-1',
    };
    const userCreate = jest.fn().mockResolvedValue(createdUser);
    const orgCreate = jest.fn().mockResolvedValue({ id: 'org-g', name: 'Agency G', slug: 'agency-g' });
    const memberCreate = jest.fn().mockResolvedValue({
      userId: 'u-google',
      organizationId: 'org-g',
      role: 'OWNER',
    });
    const pipelineCreate = jest.fn().mockResolvedValue({ id: 'p1' });
    const stageCreateMany = jest.fn().mockResolvedValue({ count: 10 });

    (prisma.organization as unknown as { findUnique: jest.Mock }).findUnique = jest
      .fn()
      .mockResolvedValue(null);
    (prisma.organization as unknown as { create: jest.Mock }).create = orgCreate;
    (prisma.user as unknown as { create: jest.Mock }).create = userCreate;
    (prisma.organizationMember as unknown as { create: jest.Mock }).create = memberCreate;
    (prisma.pipeline as unknown as { create: jest.Mock }).create = pipelineCreate;
    (prisma.pipelineStage as unknown as { createMany: jest.Mock }).createMany = stageCreateMany;
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
      fn(prisma),
    );
    (prisma.organization as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'org-g', name: 'Agency G' });
    (prisma.user as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue(createdUser);
    (prisma.refreshToken as unknown as { create: jest.Mock }).create = jest.fn().mockResolvedValue({});

    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());
    const result = await service.googleAuth({
      idToken: 'valid-id-token',
      organizationName: 'Agency G',
      locale: 'pt',
      acceptTerms: true,
    });

    expect(userCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          googleId: 'google-sub-1',
          passwordHash: null,
          email: 'nova@agency.dev',
        }),
      }),
    );
    expect(result.user.organizationId).toBe('org-g');
    expect(result.accessToken).toBe('token');
  });

  it('googleAuth logs in existing googleId user', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-1',
        email: 'ana@agency.dev',
        email_verified: true,
        name: 'Ana',
      }),
    });

    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@agency.dev',
      name: 'Ana',
      locale: 'pt',
      googleId: 'google-sub-1',
      avatarUrl: null,
      memberships: [{ organizationId: 'org1', role: 'OWNER' }],
    });
    prisma.organization.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'org1', name: 'Org' });
    (prisma.user as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'ana@agency.dev', locale: 'pt' });
    prisma.refreshToken.create = jest.fn().mockResolvedValue({});

    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());
    const result = await service.googleAuth({ idToken: 'valid-id-token' });
    expect(result.user.organizationId).toBe('org1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('googleAuth accepts accessToken via Google userinfo', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ aud: 'google-client-id.apps.googleusercontent.com' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-sub-1',
          email: 'ana@agency.dev',
          email_verified: true,
          name: 'Ana',
        }),
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@agency.dev',
      name: 'Ana',
      locale: 'pt',
      googleId: 'google-sub-1',
      avatarUrl: null,
      memberships: [{ organizationId: 'org1', role: 'OWNER' }],
    });
    prisma.organization.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'org1', name: 'Org' });
    (prisma.user as unknown as { findUniqueOrThrow: jest.Mock }).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'ana@agency.dev', locale: 'pt' });
    prisma.refreshToken.create = jest.fn().mockResolvedValue({});

    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());
    const result = await service.googleAuth({ accessToken: 'ya29.access-token' });
    expect(result.user.organizationId).toBe('org1');
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stores a requested email as pending until it is verified', async () => {
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'attacker@evil.dev',
      pendingEmail: null,
      passwordHash: 'hash',
      locale: 'pt',
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.update.mockResolvedValue({});
    const mail = makeMail();
    const service = new AuthService(prisma, makeJwt(), makeConfig(), mail);

    await service.changeEmail(
      'u1',
      { newEmail: 'victim@company.com', currentPassword: 'RightPass1!' },
      { ip: '1.2.3.4' },
    );

    const changeRequest = prisma.user.update.mock.calls[0][0];
    expect(changeRequest).toEqual(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ pendingEmail: 'victim@company.com' }),
      }),
    );
    expect(changeRequest.data.email).toBeUndefined();
    expect(changeRequest.data.emailVerifiedAt).toBeUndefined();
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'victim@company.com' }));
  });

  it('claims a pending email only after its verification token is redeemed', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst
      .mockResolvedValueOnce({
        id: 'u1',
        email: 'attacker@evil.dev',
        pendingEmail: 'victim@company.com',
        emailVerifyTokenHash: 'hash',
        emailVerifyTokenExpiresAt: new Date(Date.now() + 60_000),
      })
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({});
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await service.verifyEmail('raw-token');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        email: 'victim@company.com',
        pendingEmail: null,
        emailVerifiedAt: expect.any(Date),
        emailVerifyTokenHash: null,
        emailVerifyTokenExpiresAt: null,
      },
    });
  });

  it('forgotPassword does not send email for unknown account', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const mail = makeMail();
    const service = new AuthService(prisma, makeJwt(), makeConfig(), mail);

    await service.forgotPassword('missing@agency.dev');

    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('forgotPassword does not send email for Google-only account without password', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'google@agency.dev',
      passwordHash: null,
      locale: 'pt',
    });
    const mail = makeMail();
    const service = new AuthService(prisma, makeJwt(), makeConfig(), mail);

    await service.forgotPassword('google@agency.dev');

    expect(mail.send).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('forgotPassword sends reset email without logging the raw token', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@agency.dev',
      passwordHash: 'hash',
      locale: 'pt',
    });
    prisma.user.update.mockResolvedValue({});
    const mail = makeMail();

    const service = new AuthService(
      prisma,
      makeJwt(),
      makeConfig({ frontendUrl: 'https://app.prospectly.dev' }),
      mail,
    );
    const loggerLog = jest.spyOn(
      (service as unknown as { logger: { log: (...args: unknown[]) => void } }).logger,
      'log',
    );

    await service.forgotPassword('ana@agency.dev');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          resetTokenHash: expect.any(String),
          resetTokenExpiresAt: expect.any(Date),
        }),
      }),
    );
    expect(mail.send).toHaveBeenCalledTimes(1);
    const payload = (mail.send as jest.Mock).mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(payload.to).toBe('ana@agency.dev');
    expect(payload.subject).toMatch(/senha|password/i);
    expect(payload.text).toContain('https://app.prospectly.dev/reset-password?token=');
    expect(payload.html).toContain('/reset-password?token=');

    const tokenMatch = payload.text.match(/token=([a-f0-9]+)/);
    expect(tokenMatch?.[1]).toBeTruthy();
    const rawToken = tokenMatch![1]!;
    const storedHash = (prisma.user.update as jest.Mock).mock.calls[0][0].data.resetTokenHash as string;
    expect(storedHash).toBe(createHash('sha256').update(rawToken).digest('hex'));

    for (const call of loggerLog.mock.calls) {
      const joined = call.map(String).join(' ');
      expect(joined).not.toContain(rawToken);
    }
  });

  it('forgotPassword clears token and fails observably when mail send fails', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ana@agency.dev',
      passwordHash: 'hash',
      locale: 'en',
    });
    prisma.user.update.mockResolvedValue({});
    const mail = makeMail({
      send: jest.fn().mockRejectedValue(new Error('Resend send failed')),
    });
    const service = new AuthService(prisma, makeJwt(), makeConfig(), mail);

    await expect(service.forgotPassword('ana@agency.dev')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: { resetTokenHash: null, resetTokenExpiresAt: null },
      }),
    );
  });

  it('forgotPassword fails before lookup when mail is not configured in production', async () => {
    const prisma = makePrisma();
    const mail = makeMail({ isConfigured: jest.fn().mockReturnValue(false) });
    const service = new AuthService(
      prisma,
      makeJwt(),
      makeConfig({ nodeEnv: 'production' }),
      mail,
    );

    await expect(service.forgotPassword('ana@agency.dev')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('resetPassword rejects expired or unknown token', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await expect(service.resetPassword('dead-token', 'NewPass1!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('resetPassword updates password, clears token and revokes sessions', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'ana@agency.dev' });
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await service.resetPassword('raw-token-value', 'NewPass1!');

    expect(argon2.hash).toHaveBeenCalledWith('NewPass1!');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          passwordHash: 'hashed',
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
  });

  it('resetPassword rejects reused token after clearing', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst
      .mockResolvedValueOnce({ id: 'u1', email: 'ana@agency.dev' })
      .mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = new AuthService(prisma, makeJwt(), makeConfig(), makeMail());

    await service.resetPassword('one-time-token', 'NewPass1!');
    await expect(service.resetPassword('one-time-token', 'NewPass2!')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
