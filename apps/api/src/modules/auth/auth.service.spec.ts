import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

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
    user: { findUnique: jest.Mock; update: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
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

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('register rejects duplicated email with generic message', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

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

    const service = new AuthService(prisma, makeJwt(), makeConfig());
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
    const service = new AuthService(prisma, makeJwt(), makeConfig());

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
    const service = new AuthService(prisma, makeJwt(), makeConfig());

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

    const service = new AuthService(prisma, makeJwt(), makeConfig());
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
    });

    const service = new AuthService(prisma, jwt, makeConfig());
    await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('refresh reuse of rotated token revokes all sessions', async () => {
    const jwt = makeJwt();
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', jti: 'jti-1' });
    const prisma = makePrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
      id: 'jti-1',
      tokenHash: 'hash',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
      replacedById: 'jti-2',
    });
    prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 2 });

    const service = new AuthService(prisma, jwt, makeConfig());
    await expect(service.refresh('reused-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      }),
    );
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

    const service = new AuthService(prisma, makeJwt(), makeConfig());
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

    const service = new AuthService(prisma, makeJwt(), makeConfig());
    const result = await service.googleAuth({ idToken: 'valid-id-token' });
    expect(result.user.organizationId).toBe('org1');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
