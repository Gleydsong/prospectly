import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const makeContext = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

const makeReflector = (roles?: string[], isPublic = false): Reflector =>
  ({
    getAllAndOverride: jest
      .fn()
      .mockImplementationOnce(() => isPublic)
      .mockImplementationOnce(() => roles),
  }) as unknown as Reflector;

describe('RolesGuard', () => {
  it('allows public routes', () => {
    const guard = new RolesGuard(makeReflector(undefined, true));
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows when no roles required', () => {
    const guard = new RolesGuard(makeReflector(undefined));
    expect(
      guard.canActivate(
        makeContext({ id: 'u', email: 'e', organizationId: 'o', role: 'VIEWER' }),
      ),
    ).toBe(true);
  });

  it('allows higher hierarchy role (ADMIN reaches SALES route)', () => {
    const guard = new RolesGuard(makeReflector(['SALES']));
    expect(
      guard.canActivate(
        makeContext({ id: 'u', email: 'e', organizationId: 'o', role: 'ADMIN' }),
      ),
    ).toBe(true);
  });

  it('blocks lower hierarchy role (VIEWER cannot reach SALES route)', () => {
    const guard = new RolesGuard(makeReflector(['SALES']));
    expect(() =>
      guard.canActivate(
        makeContext({ id: 'u', email: 'e', organizationId: 'o', role: 'VIEWER' }),
      ),
    ).toThrow(ForbiddenException);
  });
});
