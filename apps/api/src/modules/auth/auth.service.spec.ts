import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  verify: jest.fn(),
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

const makeConfig = () =>
  ({
    get: (key: string) =>
      ({
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
        nodeEnv: 'test',
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

  it('register rejects duplicated email', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    const service = new AuthService(prisma, makeJwt(), makeConfig());

    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@agency.dev',
        password: 'Passw0rd!',
        organizationName: 'Agency',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
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
      memberships: [{ organizationId: 'org1', role: 'OWNER' }],
    });
    prisma.organization.findUniqueOrThrow = jest.fn().mockResolvedValue({ id: 'org1', name: 'Org' });
    prisma.refreshToken.create = jest.fn().mockResolvedValue({});
    (prisma.user as unknown as Record<string, jest.Mock>).findUniqueOrThrow = jest
      .fn()
      .mockResolvedValue({ id: 'u1', email: 'a@b.dev' });

    const service = new AuthService(prisma, makeJwt(), makeConfig());
    const result = await service.login({ email: 'a@b.dev', password: 'RightPass1' });

    expect(result.user.organizationId).toBe('org1');
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
    });

    const service = new AuthService(prisma, jwt, makeConfig());
    await expect(service.refresh('stale-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
