import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { DSR_STATUS, UsersService } from './users.service';

const makeAudit = () =>
  ({ log: jest.fn().mockResolvedValue(undefined) }) as unknown as AuditService & { log: jest.Mock };

const makePrisma = () => {
  const prisma = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    organizationMember: { findMany: jest.fn(), findUnique: jest.fn() },
    dataSubjectRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & typeof prisma;
};

describe('UsersService data-subject workflow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates PENDING requests and audits without secrets', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.dataSubjectRequest.create.mockResolvedValue({
      id: 'dsr1',
      type: 'EXPORT',
      status: DSR_STATUS.PENDING,
      createdAt: new Date(),
    });
    const service = new UsersService(prisma, audit);

    await service.createDataSubjectRequest('u1', 'EXPORT', 'notes', 'org1');

    expect(prisma.dataSubjectRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'u1', organizationId: 'org1', type: 'EXPORT' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org1',
        userId: 'u1',
        entityId: 'dsr1',
        metadata: { type: 'EXPORT', status: DSR_STATUS.PENDING },
      }),
    );
  });

  it('lists only requests from the current organization', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.dataSubjectRequest.findMany.mockResolvedValue([{ id: 'dsr1' }]);
    const service = new UsersService(prisma, audit);

    await service.listDataSubjectRequests('org1');

    expect(prisma.dataSubjectRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org1' },
      }),
    );
  });

  it('approves PENDING and schedules completion stub', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.dataSubjectRequest.findFirst.mockResolvedValueOnce({
      id: 'dsr1',
      userId: 'u1',
      status: DSR_STATUS.PENDING,
      type: 'DELETE',
    });
    prisma.dataSubjectRequest.findUnique.mockResolvedValueOnce({
      status: DSR_STATUS.APPROVED,
      type: 'DELETE',
    });
    prisma.dataSubjectRequest.update.mockResolvedValue({
      id: 'dsr1',
      userId: 'u1',
      type: 'DELETE',
      status: DSR_STATUS.APPROVED,
    });
    prisma.dataSubjectRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.dataSubjectRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'dsr1',
      userId: 'u1',
      type: 'DELETE',
      status: DSR_STATUS.COMPLETED,
      confirmationChannel: 'email_stub',
    });
    const service = new UsersService(prisma, audit);

    const approved = await service.approveDataSubjectRequest('org1', 'dsr1', 'owner1');
    expect(approved.status).toBe(DSR_STATUS.APPROVED);

    await new Promise((r) => setImmediate(r));
    expect(prisma.dataSubjectRequest.updateMany).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: expect.stringContaining('approved') }),
    );
  });

  it('rejects complete while still PENDING', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.dataSubjectRequest.findFirst.mockResolvedValue({
      id: 'dsr1',
      userId: 'u1',
      status: DSR_STATUS.PENDING,
      type: 'EXPORT',
    });
    const service = new UsersService(prisma, audit);

    await expect(
      service.completeDataSubjectRequest('org1', 'dsr1', 'owner1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 when request is outside organization', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.dataSubjectRequest.findFirst.mockResolvedValue(null);
    const service = new UsersService(prisma, audit);

    await expect(
      service.approveDataSubjectRequest('org1', 'dsr1', 'owner1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
