import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { OrganizationFlagsService } from './organization-flags.service';

const makePrisma = () => {
  const prisma = {
    organizationFlag: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & {
    organizationFlag: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
};

describe('OrganizationFlagsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists allowlisted keys with missing rows as OFF', async () => {
    const prisma = makePrisma();
    prisma.organizationFlag.findMany.mockResolvedValue([]);
    const service = new OrganizationFlagsService(prisma);

    await expect(service.list('org-a')).resolves.toEqual([{ key: 'saved_report', enabled: false }]);
    expect(prisma.organizationFlag.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
      select: { key: true, enabled: true },
    });
  });

  it('does not return flags stored for another organization', async () => {
    const prisma = makePrisma();
    prisma.organizationFlag.findMany.mockResolvedValue([]);
    const service = new OrganizationFlagsService(prisma);

    await service.list('org-b');

    expect(prisma.organizationFlag.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-b' },
      select: { key: true, enabled: true },
    });
  });

  it('reads enabled from the row of the session organization', async () => {
    const prisma = makePrisma();
    prisma.organizationFlag.findMany.mockResolvedValue([{ key: 'saved_report', enabled: true }]);
    const service = new OrganizationFlagsService(prisma);

    await expect(service.list('org-a')).resolves.toEqual([{ key: 'saved_report', enabled: true }]);
  });

  it('ignores unknown keys persisted in the database', async () => {
    const prisma = makePrisma();
    prisma.organizationFlag.findMany.mockResolvedValue([
      { key: 'gmail', enabled: true },
      { key: 'saved_report', enabled: false },
    ]);
    const service = new OrganizationFlagsService(prisma);

    await expect(service.list('org-a')).resolves.toEqual([{ key: 'saved_report', enabled: false }]);
  });

  it('rejects an unknown key on write', async () => {
    const prisma = makePrisma();
    const service = new OrganizationFlagsService(prisma);

    await expect(service.set('org-a', 'gmail', true)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.organizationFlag.upsert).not.toHaveBeenCalled();
  });

  it('upserts an allowlisted flag without deleting history', async () => {
    const prisma = makePrisma();
    prisma.organizationFlag.upsert.mockResolvedValue({
      key: 'saved_report',
      enabled: false,
    });
    const service = new OrganizationFlagsService(prisma);

    await expect(service.set('org-a', 'saved_report', false)).resolves.toEqual({
      key: 'saved_report',
      enabled: false,
    });
    expect(prisma.organizationFlag.upsert).toHaveBeenCalledWith({
      where: { organizationId_key: { organizationId: 'org-a', key: 'saved_report' } },
      create: { organizationId: 'org-a', key: 'saved_report', enabled: false },
      update: { enabled: false },
      select: { key: true, enabled: true },
    });
    expect(prisma.organizationFlag.delete).not.toHaveBeenCalled();
    expect(prisma.organizationFlag.deleteMany).not.toHaveBeenCalled();
  });

  it('treats a missing row as OFF on isEnabled', async () => {
    const prisma = makePrisma();
    prisma.organizationFlag.findFirst.mockResolvedValue(null);
    const service = new OrganizationFlagsService(prisma);

    await expect(service.isEnabled('org-a', 'saved_report')).resolves.toBe(false);
    expect(prisma.organizationFlag.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-a', key: 'saved_report' },
      select: { enabled: true },
    });
  });
});
