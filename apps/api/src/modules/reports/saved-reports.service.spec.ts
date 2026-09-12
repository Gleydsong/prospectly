import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { ReportsService } from './reports.service';
import { SavedReportsService } from './saved-reports.service';

const makePrisma = () => {
  const prisma = {
    savedReport: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    savedView: {
      findMany: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & {
    savedReport: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    savedView: { findMany: jest.Mock };
  };
};

const row = {
  id: 'rep-1',
  organizationId: 'org-a',
  ownerId: 'user-1',
  name: '30d Google',
  nameNormalized: '30d google',
  definition: { period: '30d', source: 'GOOGLE_PLACES' },
  archivedAt: null,
  createdAt: new Date('2026-09-12T00:00:00.000Z'),
  updatedAt: new Date('2026-09-12T00:00:00.000Z'),
};

describe('SavedReportsService', () => {
  const reports = {
    funnelConversion: jest.fn(),
    funnelConversionLeads: jest.fn(),
  } as unknown as ReportsService & {
    funnelConversion: jest.Mock;
    funnelConversionLeads: jest.Mock;
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a Relatório salvo for SALES and never writes a Vista', async () => {
    const prisma = makePrisma();
    prisma.savedReport.create.mockResolvedValue(row);
    const service = new SavedReportsService(prisma, reports);

    const created = await service.create('org-a', { id: 'user-1', role: 'SALES' }, {
      name: '30d Google',
      definition: { period: '30d', source: 'GOOGLE_PLACES' },
    });

    expect(prisma.savedReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          ownerId: 'user-1',
          name: '30d Google',
          nameNormalized: '30d google',
        }),
      }),
    );
    expect(prisma.savedView.findMany).not.toHaveBeenCalled();
    expect(created).toEqual(
      expect.objectContaining({
        name: '30d Google',
        definition: { period: '30d', source: 'GOOGLE_PLACES' },
        canEdit: true,
      }),
    );
  });

  it('rejects VIEWER create', async () => {
    const prisma = makePrisma();
    const service = new SavedReportsService(prisma, reports);
    await expect(
      service.create('org-a', { id: 'viewer-1', role: 'VIEWER' }, {
        name: '30d',
        definition: { period: '30d' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.savedReport.create).not.toHaveBeenCalled();
  });

  it('does not list another organization', async () => {
    const prisma = makePrisma();
    prisma.savedReport.findMany.mockResolvedValue([]);
    const service = new SavedReportsService(prisma, reports);

    await service.list('org-b', { id: 'user-2', role: 'VIEWER' });

    expect(prisma.savedReport.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-b', archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('does not reveal a Relatório salvo from another org', async () => {
    const prisma = makePrisma();
    prisma.savedReport.findFirst.mockResolvedValue(null);
    const service = new SavedReportsService(prisma, reports);

    await expect(
      service.get('org-b', { id: 'user-2', role: 'VIEWER' }, 'rep-from-org-a'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.savedReport.findFirst).toHaveBeenCalledWith({
      where: { id: 'rep-from-org-a', organizationId: 'org-b', archivedAt: null },
    });
  });

  it('opens a saved recorte with the same conversion as the ephemeral query', async () => {
    const prisma = makePrisma();
    prisma.savedReport.findFirst.mockResolvedValue(row);
    reports.funnelConversion.mockResolvedValue({
      period: '30d',
      periodStart: '2026-08-13T12:00:00.000Z',
      inflow: 4,
      wins: 1,
      losses: 1,
      winRate: 50,
      bySource: [],
    });
    const service = new SavedReportsService(prisma, reports);

    const conversion = await service.funnelConversion('org-a', { id: 'viewer-1', role: 'VIEWER' }, 'rep-1');

    expect(reports.funnelConversion).toHaveBeenCalledWith('org-a', {
      period: '30d',
      source: 'GOOGLE_PLACES',
    });
    expect(conversion.inflow).toBe(4);
    expect(conversion.wins).toBe(1);
  });

  it('lets OWNER archive someone else Relatório salvo', async () => {
    const prisma = makePrisma();
    prisma.savedReport.findFirst.mockResolvedValue(row);
    prisma.savedReport.update.mockResolvedValue({ ...row, archivedAt: new Date() });
    const service = new SavedReportsService(prisma, reports);

    await service.archive('org-a', { id: 'owner-1', role: 'OWNER' }, 'rep-1');
    expect(prisma.savedReport.update).toHaveBeenCalledWith({
      where: { id: 'rep-1' },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('does not let SALES archive another owner Relatório salvo', async () => {
    const prisma = makePrisma();
    prisma.savedReport.findFirst.mockResolvedValue(row);
    const service = new SavedReportsService(prisma, reports);

    await expect(
      service.archive('org-a', { id: 'sales-2', role: 'SALES' }, 'rep-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.savedReport.update).not.toHaveBeenCalled();
  });

  it('maps a duplicate name to conflict', async () => {
    const prisma = makePrisma();
    prisma.savedReport.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const service = new SavedReportsService(prisma, reports);

    await expect(
      service.create('org-a', { id: 'user-1', role: 'MEMBER' }, {
        name: '30d Google',
        definition: { period: '30d' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
