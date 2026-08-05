import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import { OrganizationsService } from './organizations.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}));

const makePrisma = () => {
  const prisma = {
    organizationMember: {
      findFirst: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    },
    user: { findUnique: jest.fn(), create: jest.fn() },
  };
  return prisma as unknown as PrismaService & {
    organizationMember: {
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      create: jest.Mock;
    };
    user: { findUnique: jest.Mock; create: jest.Mock };
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
    const service = new OrganizationsService(prisma, makeAudit());

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
    const service = new OrganizationsService(prisma, makeAudit());

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
    const service = new OrganizationsService(prisma, makeAudit());

    await service.removeMember('org1', 'm-member', 'admin-1', 'ADMIN');
    expect(prisma.organizationMember.delete).toHaveBeenCalledWith({
      where: { id: 'm-member' },
    });
  });
});

describe('OrganizationsService.inviteMember', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not auto-attach an existing unverified user', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'attacker',
      email: 'victim@company.com',
      emailVerifiedAt: null,
      memberships: [],
    });
    const service = new OrganizationsService(prisma, makeAudit());

    await expect(
      service.inviteMember('org1', {
        email: 'victim@company.com',
        name: 'Victim',
        role: 'SALES',
        temporaryPassword: 'TempPass1!',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.organizationMember.create).not.toHaveBeenCalled();
  });

  it('attaches an existing verified user', async () => {
    const prisma = makePrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      email: 'colleague@company.com',
      emailVerifiedAt: new Date(),
      memberships: [],
    });
    prisma.organizationMember.create.mockResolvedValue({
      id: 'm2',
      userId: 'u2',
      role: 'SALES',
      user: { id: 'u2', name: 'Colleague', email: 'colleague@company.com' },
    });
    const service = new OrganizationsService(prisma, makeAudit());

    await service.inviteMember('org1', {
      email: 'colleague@company.com',
      name: 'Colleague',
      role: 'SALES',
      temporaryPassword: 'TempPass1!',
    });

    expect(argon2.hash).toHaveBeenCalledWith('TempPass1!');
    expect(prisma.organizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: 'u2', organizationId: 'org1', role: 'SALES' },
      }),
    );
  });
});
