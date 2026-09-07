import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CustomFieldType } from '@prisma/client';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { LeadIngestionService } from './lead-ingestion.service';
import { collectMissingLeadFields, LeadsService } from './leads.service';
import type { CreateLeadDto } from './dto/create-lead.dto';

const makePrisma = () => {
  const prisma = {
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tag: { findMany: jest.fn(), upsert: jest.fn() },
    leadTag: { createMany: jest.fn(), deleteMany: jest.fn() },
    leadActivity: { create: jest.fn() },
    organizationMember: { findUnique: jest.fn() },
    task: { deleteMany: jest.fn() },
    customFieldDefinition: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (operations: unknown[]) => Promise.all(operations)),
  };
  return prisma as unknown as PrismaService & {
    lead: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    organizationMember: { findUnique: jest.Mock };
    task: { deleteMany: jest.Mock };
    customFieldDefinition: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
};

const makeIngestion = () =>
  ({ ingest: jest.fn() }) as unknown as LeadIngestionService & {
    ingest: jest.Mock;
  };

const makeEntitlements = () =>
  ({
    assertFeature: jest.fn().mockResolvedValue(undefined),
  }) as { assertFeature: jest.Mock };

const baseDto: CreateLeadDto = {
  companyName: 'Restaurante Teste',
  email: 'contato@teste.pt',
  website: 'https://teste.pt',
  phone: '+351210000000',
};

describe('LeadsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('create throws ConflictException when domain already exists', async () => {
    const prisma = makePrisma();
    const ingestion = makeIngestion();
    ingestion.ingest.mockResolvedValue({
      status: 'DUPLICATE',
      lead: { id: 'dup-1', companyName: 'Outro' },
    });
    const service = new LeadsService(prisma, ingestion, makeEntitlements() as never);

    await expect(service.create('org1', baseDto, 'user1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('create delegates manual lead creation to shared ingestion and keeps its response shape', async () => {
    const prisma = makePrisma();
    const ingestion = makeIngestion();
    ingestion.ingest.mockResolvedValue({
      status: 'IMPORTED',
      lead: { id: 'lead-1', companyName: 'Restaurante Teste', tags: [] },
    });
    const service = new LeadsService(prisma, ingestion, makeEntitlements() as never);

    const result = await service.create('org1', { ...baseDto, email: 'CONTATO@Teste.pt' }, 'user1');

    expect(ingestion.ingest).toHaveBeenCalledWith(
      'org1',
      'user1',
      expect.objectContaining({
        ...baseDto,
        email: 'CONTATO@Teste.pt',
        status: 'NEW',
        source: 'MANUAL',
        externalId: undefined,
        websitePresence: undefined,
        websiteCheckSource: undefined,
      }),
    );
    expect(result).toEqual({ id: 'lead-1', companyName: 'Restaurante Teste', tags: [] });
  });

  it('update rejects an email held by a soft-deleted lead before writing', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockImplementation(({ where }) => {
      if (where.id === 'lead-1') {
        return Promise.resolve({ id: 'lead-1', organizationId: 'org1' });
      }
      if ('deletedAt' in where) {
        return Promise.resolve(null);
      }
      return Promise.resolve({ id: 'lead-deleted', companyName: 'Lead Removido' });
    });
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(
      service.update('org1', 'lead-1', { email: 'contato@teste.pt' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.lead.findFirst).toHaveBeenLastCalledWith({
      where: {
        organizationId: 'org1',
        OR: [{ email: 'contato@teste.pt' }],
        id: { not: 'lead-1' },
      },
      select: { id: true, companyName: true },
    });
  });

  it('update translates a concurrent unique constraint violation to ConflictException', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst
      .mockResolvedValueOnce({ id: 'lead-1', organizationId: 'org1' })
      .mockResolvedValueOnce(null);
    prisma.lead.update.mockRejectedValue({ code: 'P2002' });
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(
      service.update('org1', 'lead-1', { email: 'contato@teste.pt' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update recognizes an equivalent formatted Brazilian phone stored in E.164', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockImplementation(({ where }) => {
      if (where.id === 'lead-1') {
        return Promise.resolve({ id: 'lead-1', organizationId: 'org1' });
      }
      if (where.OR?.some((condition: { phone?: string }) => condition.phone === '+5511998765432')) {
        return Promise.resolve({ id: 'lead-ingested', companyName: 'Lead Ingerido' });
      }
      return Promise.resolve(null);
    });
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(
      service.update('org1', 'lead-1', { phone: '(11) 99876-5432' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.lead.findFirst).toHaveBeenLastCalledWith({
      where: {
        organizationId: 'org1',
        OR: [{ phone: '+5511998765432' }],
        id: { not: 'lead-1' },
      },
      select: { id: true, companyName: true },
    });
  });

  it('update recomputes the probable duplicate fingerprint from existing and changed fields', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      organizationId: 'org1',
      companyName: 'Café São João',
      city: 'São Paulo',
      state: 'SP',
    });
    prisma.lead.update.mockResolvedValue({ id: 'lead-1', tags: [] });
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.update('org1', 'lead-1', { city: 'Campinas' });

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          probableDuplicateKey: 'cafe sao joao|campinas|SP',
        }),
      }),
    );
  });

  it('update merges custom field values through CustomFieldsService', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      organizationId: 'org1',
      companyName: 'Café',
      city: 'Lisboa',
      state: 'PT',
      customFieldValues: { keep: 1 },
    });
    prisma.lead.update.mockResolvedValue({ id: 'lead-1', tags: [] });
    const customFields = { mergeValues: jest.fn().mockResolvedValue({ keep: 1, nif: '123' }) };
    const service = new LeadsService(
      prisma,
      makeIngestion(),
      makeEntitlements() as never,
      undefined,
      customFields as never,
    );

    await service.update('org1', 'lead-1', { customFieldValues: { nif: '123' } });

    expect(customFields.mergeValues).toHaveBeenCalledWith('org1', { keep: 1 }, { nif: '123' });
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customFieldValues: { keep: 1, nif: '123' } }),
      }),
    );
  });

  it('list with an explicit empty ids list returns no rows instead of the whole org', async () => {
    const prisma = makePrisma();
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    const result = await service.list('org1', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ids: [],
    });

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
    expect(prisma.lead.count).not.toHaveBeenCalled();
  });

  it('list search q does not query customFieldValues and still returns them for columns', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(1);
    prisma.lead.findMany.mockResolvedValue([
      { id: 'lead-1', tags: [], customFieldValues: { nif: 'secret-nif' } },
    ]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    const result = await service.list('org1', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      q: 'secret-nif',
    });

    expect(JSON.stringify(prisma.lead.findMany.mock.calls[0]?.[0]?.where)).not.toMatch(
      /customFieldValues/,
    );
    expect(result.data[0]).toEqual(
      expect.objectContaining({ customFieldValues: { nif: 'secret-nif' } }),
    );
  });

  it('list number custom field filter compiles a JSON path bound', async () => {
    const fieldId = '11111111-1111-4111-8111-111111111111';
    const prisma = makePrisma();
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { id: fieldId, type: CustomFieldType.NUMBER },
    ]);
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.list('org1', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      filter: { field: `custom:${fieldId}`, op: 'gte', value: 10 },
    });

    expect(prisma.lead.findMany.mock.calls[0]?.[0]?.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ customFieldValues: { path: [fieldId], gte: 10 } }]),
      }),
    );
  });

  it('list unknown custom field filter is rejected', async () => {
    const prisma = makePrisma();
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(
      service.list('org1', {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filter: {
          field: 'custom:99999999-9999-4999-8999-999999999999',
          op: 'eq',
          value: 'x',
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it('list still applies a filter on an archived custom field', async () => {
    const fieldId = '33333333-3333-4333-8333-333333333333';
    const prisma = makePrisma();
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { id: fieldId, type: CustomFieldType.TEXT },
    ]);
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.list('org1', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      filter: { field: `custom:${fieldId}`, op: 'eq', value: 'legacy' },
    });

    expect(prisma.lead.findMany.mock.calls[0]?.[0]?.where).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([{ customFieldValues: { path: [fieldId], equals: 'legacy' } }]),
      }),
    );
  });

  it('list with ids constrains to those leads inside the tenant', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.list('org1', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ids: ['11111111-1111-4111-8111-111111111111'],
    });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org1',
          deletedAt: null,
          id: { in: ['11111111-1111-4111-8111-111111111111'] },
        }),
      }),
    );
  });

  it('list always scopes by organization and excludes soft-deleted', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.list('org1', { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' });

    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: 'org1', deletedAt: null }),
    });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org1', deletedAt: null }),
      }),
    );
  });

  it('list compiles filter AST ANDed with tenant scope and ignores flat predicates', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(0);
    prisma.lead.findMany.mockResolvedValue([]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.list('org1', {
      page: 1,
      pageSize: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      city: 'Porto',
      filter: {
        op: 'and',
        nodes: [
          { field: 'city', op: 'eq', value: 'Lisboa' },
          { field: 'lastContactAt', op: 'older_than', days: 14 },
        ],
      },
    });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: 'org1', deletedAt: null },
            {
              AND: [
                { city: { equals: 'Lisboa', mode: 'insensitive' } },
                {
                  OR: [{ lastContactAt: { lt: expect.any(Date) } }, { lastContactAt: null }],
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it('list rejects an unknown filter field', async () => {
    const prisma = makePrisma();
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(
      service.list('org1', {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        filter: { field: 'email', op: 'eq', value: 'a@b.c' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
  });

  it('listIds scopes by organization and returns ids with total', async () => {
    const prisma = makePrisma();
    prisma.lead.count.mockResolvedValue(2);
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1' }, { id: 'lead-2' }]);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(service.listIds('org1', { city: 'Lisboa' }, 201)).resolves.toEqual({
      ids: ['lead-1', 'lead-2'],
      total: 2,
    });

    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        organizationId: 'org1',
        deletedAt: null,
        city: expect.anything(),
      }),
    });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org1', deletedAt: null }),
        select: { id: true },
        take: 201,
      }),
    );
  });

  it('getById throws NotFoundException for lead from another org', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await expect(service.getById('org-A', 'lead-from-org-B')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-A' }),
      }),
    );
  });

  it('softDelete marks deletedAt instead of removing row', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'l1', organizationId: 'org1' });
    prisma.lead.update.mockResolvedValue({});
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.softDelete('org1', 'l1');

    expect(prisma.task.deleteMany).not.toHaveBeenCalled();
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });

  it('softDelete preserves tasks so restore can recover the lead workspace', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'l1', organizationId: 'org1', deletedAt: null });
    prisma.lead.update.mockResolvedValue({});
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.softDelete('org1', 'l1');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.task.deleteMany).not.toHaveBeenCalled();
  });

  it('softDelete is a no-op when the lead is already deleted', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'l1',
      organizationId: 'org1',
      deletedAt: new Date('2026-08-01T00:00:00.000Z'),
    });
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    await service.softDelete('org1', 'l1');

    expect(prisma.lead.update).not.toHaveBeenCalled();
    expect(prisma.task.deleteMany).not.toHaveBeenCalled();
  });

  it('collectMissingLeadFields lists blank contact and website fields', () => {
    expect(
      collectMissingLeadFields({
        phone: ' ',
        email: null,
        website: 'https://ok.example',
        whatsapp: undefined,
        address: 'Rua A',
        city: '',
        category: 'padaria',
      }),
    ).toEqual(['phone', 'email', 'whatsapp', 'city']);
  });

  it('getById includes provenance missingFields on detailed serialize', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      organizationId: 'org1',
      companyName: 'Café',
      phone: null,
      email: null,
      website: null,
      whatsapp: null,
      address: null,
      city: 'SP',
      category: null,
      source: 'OPENSTREETMAP',
      websitePresence: 'NO_WEBSITE_REPORTED',
      dataCollectedAt: new Date('2026-08-01T10:00:00.000Z'),
      lastVerifiedAt: null,
      confidenceLevel: 'LOW',
      websiteStatusReason: 'Fonte não reportou website (observação, não confirmação de ausência).',
      tags: [],
      contacts: [],
      scores: [],
      websiteRecord: null,
    });
    const service = new LeadsService(prisma, makeIngestion(), makeEntitlements() as never);

    const result = await service.getById('org1', 'lead-1');

    expect(result).toEqual(
      expect.objectContaining({
        source: 'OPENSTREETMAP',
        websitePresence: 'NO_WEBSITE_REPORTED',
        confidenceLevel: 'LOW',
        missingFields: expect.arrayContaining([
          'phone',
          'email',
          'website',
          'whatsapp',
          'address',
          'category',
        ]),
      }),
    );
    expect((result as { missingFields: string[] }).missingFields).not.toContain('city');
  });
});
