import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Role } from '@prisma/client';

import type { PrismaService } from '../../../common/prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

const payload = {
  sub: 'user-1',
  email: 'ana@example.com',
  orgId: 'org-1',
  role: 'OWNER' as Role,
};

const makeStrategy = (findUnique: jest.Mock) =>
  new JwtStrategy(
    { getOrThrow: () => 'access-secret-min-32-characters!!' } as unknown as ConfigService,
    { organizationMember: { findUnique } } as unknown as PrismaService,
  );

describe('JwtStrategy', () => {
  it('revalidates membership and returns the database role', async () => {
    const findUnique = jest.fn().mockResolvedValue({ role: 'ADMIN' });
    await expect(makeStrategy(findUnique).validate(payload)).resolves.toEqual({
      id: 'user-1',
      email: 'ana@example.com',
      organizationId: 'org-1',
      role: 'ADMIN',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: 'user-1', organizationId: 'org-1' } },
    });
  });

  it('rejects a missing membership without trusting the JWT role', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    await expect(makeStrategy(findUnique).validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(makeStrategy(findUnique).validate(payload)).rejects.toThrow('Membership revoked');
  });
});
