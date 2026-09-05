import type { PrismaService } from '../../common/prisma/prisma.service';
import type { LeadIngestionService } from './lead-ingestion.service';
import { LeadsService } from './leads.service';

const makePrisma = () => {
  const prisma = {
    lead: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & {
    lead: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
};

describe('LeadsService.exportCsv', () => {
  it('exports selected columns, escapes CSV, and writes minimal audit log', async () => {
    const prisma = makePrisma();
    prisma.lead.findMany.mockResolvedValue([
      {
        id: '1',
        companyName: 'Café "Central"',
        email: 'a@b.com',
        phone: null,
        website: null,
        city: 'Lisboa',
        status: 'NEW',
        source: 'MANUAL',
        score: 40,
        tradeName: null,
        category: null,
        segment: null,
        whatsapp: null,
        domain: null,
        state: null,
        country: null,
        rating: null,
        reviewCount: null,
        ownerId: null,
        notes: 'line1\nline2',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        lastContactAt: null,
        nextContactAt: null,
      },
    ]);
    prisma.auditLog.create.mockResolvedValue({});
    const entitlements = {
      assertFeature: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LeadsService(
      prisma,
      { ingest: jest.fn() } as unknown as LeadIngestionService,
      entitlements as never,
    );

    const result = await service.exportCsv('org-1', 'user-1', {
      columns: ['companyName', 'email', 'notes'],
      status: 'NEW' as never,
    });

    expect(entitlements.assertFeature).toHaveBeenCalledWith('org-1', 'csv_export');
    expect(result.rowCount).toBe(1);
    expect(result.csv.split('\n')[0]).toBe('companyName,email,notes');
    expect(result.csv).toContain('"Café ""Central"""');
    expect(result.csv).toContain('"line1\nline2"');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'leads.export',
        entity: 'Lead',
        metadata: expect.objectContaining({
          rowCount: 1,
          columns: ['companyName', 'email', 'notes'],
        }),
      }),
    });
    const metadata = prisma.auditLog.create.mock.calls[0][0].data.metadata as {
      filters: Record<string, unknown>;
    };
    expect(metadata.filters).not.toHaveProperty('q');
    expect(JSON.stringify(metadata)).not.toContain('a@b.com');
  });

  it('neutralizes CSV formula injection in exported cells', async () => {
    const prisma = makePrisma();
    prisma.lead.findMany.mockResolvedValue([
      {
        id: '1',
        companyName: '=CMD()',
        email: '+1+1',
        phone: null,
        website: null,
        city: null,
        status: 'NEW',
        source: 'MANUAL',
        score: 0,
        tradeName: null,
        category: null,
        segment: null,
        whatsapp: null,
        domain: null,
        state: null,
        country: null,
        rating: null,
        reviewCount: null,
        ownerId: null,
        notes: '@SUM(A1)',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        lastContactAt: null,
        nextContactAt: null,
      },
    ]);
    prisma.auditLog.create.mockResolvedValue({});
    const entitlements = { assertFeature: jest.fn().mockResolvedValue(undefined) };
    const service = new LeadsService(
      prisma,
      { ingest: jest.fn() } as unknown as LeadIngestionService,
      entitlements as never,
    );

    const result = await service.exportCsv('org-1', 'user-1', {
      columns: ['companyName', 'email', 'notes'],
    });
    expect(result.csv).toContain("'=CMD()");
    expect(result.csv).toContain("'+1+1");
    expect(result.csv).not.toMatch(/(^|,)=CMD/m);
  });

  it('blocks CSV export when csv_export entitlement is missing', async () => {
    const prisma = makePrisma();
    const entitlements = {
      assertFeature: jest.fn().mockRejectedValue(new Error('ENTITLEMENT_CSV_EXPORT')),
    };
    const service = new LeadsService(
      prisma,
      { ingest: jest.fn() } as unknown as LeadIngestionService,
      entitlements as never,
    );

    await expect(
      service.exportCsv('org-1', 'user-1', { columns: ['companyName'] }),
    ).rejects.toThrow(/ENTITLEMENT_CSV_EXPORT/);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it('compiles filter AST for export and still scopes the tenant', async () => {
    const prisma = makePrisma();
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
    const entitlements = { assertFeature: jest.fn().mockResolvedValue(undefined) };
    const service = new LeadsService(
      prisma,
      { ingest: jest.fn() } as unknown as LeadIngestionService,
      entitlements as never,
    );

    await service.exportCsv('org-1', 'user-1', {
      columns: ['companyName'],
      city: 'Porto',
      filter: { field: 'city', op: 'eq', value: 'Lisboa' },
    });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: 'org-1', deletedAt: null },
            { city: { equals: 'Lisboa', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});
