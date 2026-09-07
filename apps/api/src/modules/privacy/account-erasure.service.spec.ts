import { ConflictException, NotFoundException } from '@nestjs/common';

import { AccountErasureService, LAST_OWNER_CANNOT_SELF_DELETE } from './account-erasure.service';

const makePrisma = () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    organizationMember: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
    refreshToken: { updateMany: jest.fn() },
    googleConnection: { updateMany: jest.fn() },
    lead: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) =>
    fn(prisma),
  );
  return prisma;
};

describe('AccountErasureService', () => {
  it('anonymizes the account holder and revokes sessions', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', anonymizedAt: null });
    prisma.organizationMember.findMany.mockResolvedValue([]);
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new AccountErasureService(prisma as never, audit as never);

    await service.eraseAccount('u1', 'org-1');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.googleConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refreshTokenEncrypted: null }),
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'deleted+u1@anonymized.invalid',
          passwordHash: null,
          googleId: null,
        }),
      }),
    );
    expect(JSON.stringify(prisma.user.update.mock.calls[0][0])).not.toContain('secret');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'account.anonymized', entityId: 'u1' }),
    );
  });

  it('blocks deletion of the last organization owner', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', anonymizedAt: null });
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org-1' }]);
    prisma.organizationMember.count.mockResolvedValue(0);
    const service = new AccountErasureService(prisma as never, { log: jest.fn() } as never);

    await expect(service.eraseAccount('u1')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.eraseAccount('u1')).rejects.toThrow(LAST_OWNER_CANNOT_SELF_DELETE);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('is idempotent when already anonymized', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', anonymizedAt: new Date() });
    const service = new AccountErasureService(prisma as never, { log: jest.fn() } as never);
    await service.eraseAccount('u1');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the user does not exist', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const service = new AccountErasureService(prisma as never, { log: jest.fn() } as never);
    await expect(service.eraseAccount('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
