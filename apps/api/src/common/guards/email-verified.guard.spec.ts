import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { EmailVerifiedGuard } from './email-verified.guard';
import { REQUIRE_EMAIL_VERIFIED_KEY } from '../decorators/require-email-verified.decorator';

describe('EmailVerifiedGuard', () => {
  const makeContext = (user?: { id: string }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as never;

  it('allows when decorator is not present', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const prisma = { user: { findUnique: jest.fn() } } as never;
    const guard = new EmailVerifiedGuard(reflector, prisma);
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(true);
    expect((prisma as { user: { findUnique: jest.Mock } }).user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unverified users with EMAIL_NOT_VERIFIED', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockImplementation((key: string) =>
        key === REQUIRE_EMAIL_VERIFIED_KEY ? true : undefined,
      ),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ emailVerifiedAt: null }) },
    } as never;
    const guard = new EmailVerifiedGuard(reflector, prisma);
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows verified users', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ emailVerifiedAt: new Date() }) },
    } as never;
    const guard = new EmailVerifiedGuard(reflector, prisma);
    await expect(guard.canActivate(makeContext({ id: 'u1' }))).resolves.toBe(true);
  });
});
