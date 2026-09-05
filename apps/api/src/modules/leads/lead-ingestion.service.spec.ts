import type { PrismaService } from '../../common/prisma/prisma.service';
import {
  LeadIngestionService,
  normalizeBrazilianPhone,
  normalizePhoneForCountry,
} from './lead-ingestion.service';

const makePrisma = () => {
  const prisma = {
    lead: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    tag: { upsert: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (operation: (transaction: typeof prisma) => unknown) => operation(prisma),
  );
  return prisma as unknown as PrismaService & {
    lead: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    tag: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
};

describe('LeadIngestionService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('normalizes Brazilian phone numbers to E.164', () => {
    expect(normalizeBrazilianPhone('(11) 99876-5432')).toBe('+5511998765432');
    expect(normalizeBrazilianPhone('+55 (11) 99876-5432')).toBe('+5511998765432');
  });

  it('does not force +55 when normalizing Portuguese phones', () => {
    expect(normalizePhoneForCountry('+351 21 000 0000', 'PT')).toBe('+351210000000');
    expect(normalizePhoneForCountry('21 000 0000', 'PT')).toBe('+210000000');
    expect(normalizePhoneForCountry('(11) 99876-5432', 'BR')).toBe('+5511998765432');
  });

  it('returns DUPLICATE when the organization already has the external source identity', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-existing',
      companyName: 'Padaria Central',
    });
    const service = new LeadIngestionService(prisma);

    const result = await service.ingest('org-1', 'user-1', {
      companyName: 'Padaria Central',
      source: 'OPENSTREETMAP',
      externalId: 'node/42',
    });

    expect(result).toEqual({
      status: 'DUPLICATE',
      lead: { id: 'lead-existing', companyName: 'Padaria Central' },
    });
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        source: 'OPENSTREETMAP',
        externalId: 'node/42',
      },
      select: { id: true, companyName: true },
    });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('does not treat an external identity from another organization as a duplicate', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockImplementation(({ where }) =>
      Promise.resolve(
        where.organizationId === 'org-a'
          ? { id: 'lead-org-a', companyName: 'Padaria Central' }
          : null,
      ),
    );
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'lead-org-b', tags: [], ...data }),
    );
    const service = new LeadIngestionService(prisma);

    const result = await service.ingest('org-b', 'user-1', {
      companyName: 'Padaria Central',
      source: 'OPENSTREETMAP',
      externalId: 'node/42',
    });

    expect(result.status).toBe('IMPORTED');
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-b',
        source: 'OPENSTREETMAP',
        externalId: 'node/42',
      },
      select: { id: true, companyName: true },
    });
  });

  it.each([
    {
      description: 'normalized website domain',
      candidate: { companyName: 'Nova Loja', website: 'HTTPS://WWW.Example.COM/contato' },
      duplicate: { domain: 'example.com' },
    },
    {
      description: 'lowercase email',
      candidate: { companyName: 'Nova Loja', email: 'VENDAS@EXAMPLE.COM' },
      duplicate: { email: 'vendas@example.com' },
    },
  ])('returns DUPLICATE for a matching $description', async ({ candidate, duplicate }) => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-existing', companyName: 'Loja Existente' });
    const service = new LeadIngestionService(prisma);

    const result = await service.ingest('org-1', 'user-1', candidate);

    expect(result.status).toBe('DUPLICATE');
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        ...duplicate,
      },
      select: { id: true, companyName: true },
    });
  });

  it.each([
    {
      description: 'domain',
      candidate: { companyName: 'Nova Loja', website: 'https://example.com' },
    },
    {
      description: 'Brazilian phone',
      candidate: { companyName: 'Nova Loja', phone: '(11) 99876-5432' },
    },
    {
      description: 'email',
      candidate: { companyName: 'Nova Loja', email: 'vendas@example.com' },
    },
  ])(
    'returns the existing lead when a concurrent $description unique constraint wins',
    async ({ candidate }) => {
      const prisma = makePrisma();
      prisma.lead.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'lead-existing', companyName: 'Loja Existente' });
      prisma.lead.create.mockRejectedValue({ code: 'P2002' });
      const service = new LeadIngestionService(prisma);

      const result = await service.ingest('org-1', 'user-1', candidate);

      expect(result).toEqual({
        status: 'DUPLICATE',
        lead: { id: 'lead-existing', companyName: 'Loja Existente' },
      });
      expect(prisma.lead.create).toHaveBeenCalledTimes(1);
    },
  );

  it('returns POSSIBLE_DUPLICATE for a normalized company name in the same city and UF', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-existing',
      companyName: 'Café São João',
    });
    const service = new LeadIngestionService(prisma);

    const result = await service.ingest('org-1', 'user-1', {
      companyName: '  CAFE SAO-JOAO ',
      city: 'São Paulo',
      state: 'sp',
    });

    expect(result).toEqual({
      status: 'POSSIBLE_DUPLICATE',
      lead: { id: 'lead-existing', companyName: 'Café São João' },
    });
    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        probableDuplicateKey: 'cafe sao joao|sao paulo|SP',
      },
      select: { id: true, companyName: true },
    });
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  it('returns POSSIBLE_DUPLICATE when a concurrent probable fingerprint wins', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'lead-winner', companyName: 'Café São João' });
    prisma.lead.create.mockRejectedValue({ code: 'P2002' });
    const service = new LeadIngestionService(prisma);

    await expect(
      service.ingest('org-1', 'user-1', {
        companyName: 'CAFE SAO-JOAO',
        city: 'Sao Paulo',
        state: 'sp',
      }),
    ).resolves.toEqual({
      status: 'POSSIBLE_DUPLICATE',
      lead: { id: 'lead-winner', companyName: 'Café São João' },
    });

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ probableDuplicateKey: 'cafe sao joao|sao paulo|SP' }),
      }),
    );
  });

  it('creates normalized tags and uses TO_REVIEW defaults for a new lead', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.tag.upsert
      .mockResolvedValueOnce({ id: 'tag-sem-site', name: 'sem-site' })
      .mockResolvedValueOnce({ id: 'tag-restaurante', name: 'restaurante' });
    prisma.lead.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'lead-new', ...data }),
    );
    const service = new LeadIngestionService(prisma);

    const result = await service.ingest('org-1', 'user-1', {
      companyName: '  Restaurante da Ana  ',
      phone: '(11) 99876-5432',
      email: 'CONTATO@EXAMPLE.COM',
      city: 'São Paulo',
      state: 'sp',
      tags: [' sem-site ', 'restaurante', 'sem-site'],
    });

    expect(result.status).toBe('IMPORTED');
    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          ownerId: 'user-1',
          companyName: 'Restaurante da Ana',
          phone: '+5511998765432',
          email: 'contato@example.com',
          city: 'São Paulo',
          state: 'SP',
          probableDuplicateKey: 'restaurante da ana|sao paulo|SP',
          source: 'MANUAL',
          status: 'TO_REVIEW',
          tags: {
            create: [{ tagId: 'tag-sem-site' }, { tagId: 'tag-restaurante' }],
          },
        }),
      }),
    );
    expect(prisma.tag.upsert).toHaveBeenCalledTimes(2);
  });

  it('keeps Portuguese phone numbers without forcing Brazil country code on ingest', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'lead-pt', ...data }),
    );
    const service = new LeadIngestionService(prisma);

    await service.ingest('org-1', 'user-1', {
      companyName: 'Pastelaria Lisboa',
      phone: '+351 21 000 0000',
      city: 'Lisboa',
      state: 'Lisboa',
      country: 'PT',
    });

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+351210000000',
          country: 'PT',
          state: 'Lisboa',
        }),
      }),
    );
  });

  it('does not import identifiers present on the suppression list', async () => {
    const prisma = makePrisma();
    const suppression = { isSuppressed: jest.fn().mockResolvedValue(true) };
    const service = new LeadIngestionService(prisma, undefined, suppression as never);

    const result = await service.ingest('org-1', 'user-1', {
      companyName: 'Opt Out Ltda',
      email: 'optout@example.com',
    });

    expect(result.status).toBe('SUPPRESSED');
    expect(prisma.lead.create).not.toHaveBeenCalled();
  });

  const makeOutbox = () => ({
    appendLeadCreated: jest.fn().mockResolvedValue({ id: 'evt-created' }),
    dispatch: jest.fn().mockResolvedValue(undefined),
  });

  it('persists lead.created in the ingest transaction and dispatches after commit', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'lead-new',
        ownerId: data.ownerId,
        stageId: null,
        source: data.source,
        ...data,
      }),
    );
    const outbox = makeOutbox();
    const service = new LeadIngestionService(prisma, undefined, undefined, outbox as never);

    const result = await service.ingest('org-1', 'user-1', {
      companyName: 'Cantina da Estação',
      email: 'contato@example.com',
      phone: '(11) 99876-5432',
      source: 'MANUAL',
    });

    expect(result.status).toBe('IMPORTED');
    expect(outbox.appendLeadCreated).toHaveBeenCalledTimes(1);
    const [tx, input] = outbox.appendLeadCreated.mock.calls[0];
    expect(tx).toBe(prisma);
    expect(input).toEqual({
      organizationId: 'org-1',
      leadId: 'lead-new',
      actorId: 'user-1',
      payload: {
        leadId: 'lead-new',
        source: 'MANUAL',
        ownerId: 'user-1',
        stageId: null,
      },
    });
    expect(JSON.stringify(input.payload)).not.toMatch(/email|phone|whatsapp|Cantina/i);
    expect(outbox.dispatch).toHaveBeenCalledWith({ id: 'evt-created' });
  });

  it('does not emit lead.created for duplicates or suppressed contacts', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-existing',
      companyName: 'Padaria Central',
    });
    const outbox = makeOutbox();
    const duplicateService = new LeadIngestionService(prisma, undefined, undefined, outbox as never);

    await duplicateService.ingest('org-1', 'user-1', {
      companyName: 'Padaria Central',
      source: 'OPENSTREETMAP',
      externalId: 'node/42',
    });

    expect(outbox.appendLeadCreated).not.toHaveBeenCalled();
    expect(outbox.dispatch).not.toHaveBeenCalled();

    const suppressedOutbox = makeOutbox();
    const suppression = { isSuppressed: jest.fn().mockResolvedValue(true) };
    const suppressedService = new LeadIngestionService(
      prisma,
      undefined,
      suppression as never,
      suppressedOutbox as never,
    );
    await suppressedService.ingest('org-1', 'user-1', {
      companyName: 'Opt Out Ltda',
      email: 'optout@example.com',
    });
    expect(suppressedOutbox.appendLeadCreated).not.toHaveBeenCalled();
    expect(suppressedOutbox.dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch lead.created when the ingest transaction fails', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.lead.findMany.mockResolvedValue([]);
    prisma.lead.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'lead-new', ownerId: data.ownerId, stageId: null, source: data.source }),
    );
    const outbox = makeOutbox();
    outbox.appendLeadCreated.mockRejectedValue(new Error('outbox fail'));
    const service = new LeadIngestionService(prisma, undefined, undefined, outbox as never);

    await expect(
      service.ingest('org-1', 'user-1', { companyName: 'Cantina da Estação' }),
    ).rejects.toThrow('outbox fail');
    expect(outbox.dispatch).not.toHaveBeenCalled();
  });
});
