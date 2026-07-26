import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { OrganizationsService } from './organizations.service';

const makePrisma = () => {
  const prisma = {
    organizationMember: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & {
    organizationMember: {
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
};

const makeAudit = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuditService;

describe('OrganizationsService.updateMemberRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('blocks ADMIN from promoting a member to OWNER', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'm1',
      userId: 'u2',
      role: 'MEMBER',
      organizationId: 'org1',
    });
    const service = new OrganizationsService(prisma, makeAudit());

    await expect(
      service.updateMemberRole('org1', 'm1', 'OWNER', 'admin-1', 'ADMIN'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.organizationMember.update).not.toHaveBeenCalled();
  });

  it('blocks ADMIN from changing an existing OWNER', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'm1',
      userId: 'owner-1',
      role: 'OWNER',
      organizationId: 'org1',
    });
    const service = new OrganizationsService(prisma, makeAudit());

    await expect(
      service.updateMemberRole('org1', 'm1', 'ADMIN', 'admin-1', 'ADMIN'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows OWNER to promote a member to OWNER', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'm1',
      userId: 'u2',
      role: 'ADMIN',
      organizationId: 'org1',
    });
    prisma.organizationMember.update.mockResolvedValue({ id: 'm1', role: 'OWNER' });
    const service = new OrganizationsService(prisma, makeAudit());

    await service.updateMemberRole('org1', 'm1', 'OWNER', 'owner-1', 'OWNER');
    expect(prisma.organizationMember.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { role: 'OWNER' },
    });
  });

  it('throws when member is missing', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue(null);
    const service = new OrganizationsService(prisma, makeAudit());

    await expect(
      service.updateMemberRole('org1', 'missing', 'ADMIN', 'owner-1', 'OWNER'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OrganizationsService.removeMember', () => {
  beforeEach(() => jest.clearAllMocks());

  it('blocks ADMIN from removing an OWNER', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'm-owner',
      userId: 'owner-1',
      role: 'OWNER',
      organizationId: 'org1',
    });
    prisma.organizationMember.count.mockResolvedValue(2);
    const service = new OrganizationsService(prisma);

    await expect(
      service.removeMember('org1', 'm-owner', 'admin-1', 'ADMIN'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
  });

  it('allows OWNER to remove a co-OWNER when another OWNER remains', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'm-owner-2',
      userId: 'owner-2',
      role: 'OWNER',
      organizationId: 'org1',
    });
    prisma.organizationMember.count.mockResolvedValue(2);
    prisma.organizationMember.delete.mockResolvedValue({ id: 'm-owner-2' });
    const service = new OrganizationsService(prisma);

    await service.removeMember('org1', 'm-owner-2', 'owner-1', 'OWNER');
    expect(prisma.organizationMember.delete).toHaveBeenCalledWith({
      where: { id: 'm-owner-2' },
    });
  });

  it('allows ADMIN to remove a MEMBER', async () => {
    const prisma = makePrisma();
    prisma.organizationMember.findFirst.mockResolvedValue({
      id: 'm-member',
      userId: 'user-2',
      role: 'MEMBER',
      organizationId: 'org1',
    });
    prisma.organizationMember.delete.mockResolvedValue({ id: 'm-member' });
    const service = new OrganizationsService(prisma);

    await service.removeMember('org1', 'm-member', 'admin-1', 'ADMIN');
    expect(prisma.organizationMember.delete).toHaveBeenCalledWith({
      where: { id: 'm-member' },
    });
  });
});
