import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PROSPECTING_CATEGORIES } from '@prospectly/shared-types';

import { OpportunityFinderService } from './opportunity-finder.service';

describe('OpportunityFinderService tenant isolation', () => {
  const prisma = {
    opportunityRun: { findFirst: jest.fn() },
    opportunityCandidate: { findMany: jest.fn(), count: jest.fn() },
  };
  const service = new OpportunityFinderService(
    prisma as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('does not reveal runs belonging to another organization', async () => {
    prisma.opportunityRun.findFirst.mockResolvedValue(null);
    await expect(service.get('org-b', 'run-from-org-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.opportunityRun.findFirst).toHaveBeenCalledWith({
      where: { id: 'run-from-org-a', organizationId: 'org-b' },
    });
  });

  it('checks the run tenant before listing candidate data', async () => {
    prisma.opportunityRun.findFirst.mockResolvedValue(null);
    await expect(service.listCandidates('org-b', 'run-from-org-a', { pageSize: 20 }))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.opportunityCandidate.findMany).not.toHaveBeenCalled();
  });

  it('uses the tenant idempotency constraint for double submissions', async () => {
    const now = new Date('2026-08-12T10:00:00.000Z');
    const existingRun = {
      id: 'run-1', status: 'PREPARING', service: 'Criação de sites', city: 'Curitiba',
      state: 'PR', country: 'BR', profile: null, searchStrategy: null,
      scoringVersion: 'opportunity-score-v1', candidateCount: 0, analyzedCount: 0,
      failedCount: 0, errorCode: null, errorMessage: null, startedAt: now,
      completedAt: null, createdAt: now,
    };
    const persistence = {
      opportunityRun: {
        findUnique: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingRun),
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const billing = {
      assertCanCreateSearch: jest.fn().mockResolvedValue(undefined),
      consumeCreditForOpportunityRun: jest.fn().mockResolvedValue(undefined),
      refundOpportunityRunCredit: jest.fn().mockResolvedValue(undefined),
      consumeCreditForExplain: jest.fn().mockResolvedValue(undefined),
      consumeCreditForSaveLead: jest.fn().mockResolvedValue(undefined),
      refundExplainCredit: jest.fn().mockResolvedValue(undefined),
      refundSaveLeadCredit: jest.fn().mockResolvedValue(undefined),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const idempotentService = new OpportunityFinderService(
      persistence as never,
      queue as never,
      { list: () => [{ available: true }] } as never,
      {} as never,
      { listCategories: jest.fn().mockResolvedValue({
        categories: [{ value: 'restaurant', label: 'Restaurante', available: true }],
        requiredPlan: 'STARTER_MONTHLY',
      }) } as never,
      billing as never,
      {} as never,
      {} as never,
      audit as never,
    );

    await expect(idempotentService.create('org-1', 'user-1', {
      service: 'Criação de sites', niche: 'restaurantes', city: 'Curitiba', state: 'PR', country: 'BR',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
    })).resolves.toMatchObject({ id: 'run-1' });
    expect(persistence.opportunityRun.create).toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(billing.consumeCreditForOpportunityRun).not.toHaveBeenCalled();
    expect(billing.assertCanCreateSearch).toHaveBeenCalledWith('org-1', 16);
  });
});

describe('OpportunityFinderService niche targeting', () => {
  const now = new Date('2026-08-15T10:00:00.000Z');
  const fullCatalog = {
    categories: PROSPECTING_CATEGORIES.map((category) => ({ ...category, available: true })),
    total: PROSPECTING_CATEGORIES.length,
    availableCount: PROSPECTING_CATEGORIES.length,
    plan: 'STARTER_MONTHLY',
    requiredPlan: 'STARTER_MONTHLY',
  };

  function createHarness(overrides?: {
    catalog?: typeof fullCatalog;
    aiProfile?: Record<string, unknown> | null;
    aiStrategy?: Record<string, unknown> | null;
    providerResults?: Array<Record<string, unknown>>;
  }) {
    const prisma = {
      opportunityRun: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      opportunityCandidate: {
        upsert: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({}) };
    const provider = { search: jest.fn().mockResolvedValue(overrides?.providerResults ?? []) };
    const providers = {
      list: jest.fn().mockReturnValue([{ id: 'GOOGLE_PLACES', label: 'Google', available: true }]),
      resolve: jest.fn().mockReturnValue(provider),
    };
    const prospecting = { listCategories: jest.fn().mockResolvedValue(overrides?.catalog ?? fullCatalog) };
    const billing = {
      assertCanCreateSearch: jest.fn().mockResolvedValue(undefined),
      consumeCreditForOpportunityRun: jest.fn().mockResolvedValue(undefined),
      refundOpportunityRunCredit: jest.fn().mockResolvedValue(undefined),
    };
    const ai = {
      buildOpportunityProfile: jest.fn().mockResolvedValue(overrides?.aiProfile ?? null),
      buildSearchStrategy: jest.fn().mockResolvedValue(overrides?.aiStrategy ?? null),
      explainOpportunity: jest.fn().mockResolvedValue(null),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const websiteAnalyzer = { analyze: jest.fn() };
    const metrics = { recordJobRecovered: jest.fn() };
    const service = new OpportunityFinderService(
      prisma as never,
      queue as never,
      providers as never,
      websiteAnalyzer as never,
      prospecting as never,
      billing as never,
      ai as never,
      {} as never,
      audit as never,
      metrics as never,
    );
    return { service, prisma, queue, provider, prospecting, billing, ai, audit, metrics };
  }

  it('rejects an unknown niche before creating a run or charging credits', async () => {
    const harness = createHarness();

    await expect(harness.service.create('org-1', 'user-1', {
      service: 'Criação de sites', niche: 'consultoria de processos', city: 'Curitiba', state: 'PR', country: 'BR',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.prospecting.listCategories).not.toHaveBeenCalled();
    expect(harness.billing.assertCanCreateSearch).not.toHaveBeenCalled();
    expect(harness.prisma.opportunityRun.create).not.toHaveBeenCalled();
    expect(harness.queue.add).not.toHaveBeenCalled();
  });

  it('rejects an ambiguous niche before creating a run', async () => {
    const harness = createHarness();

    await expect(harness.service.create('org-1', 'user-1', {
      service: 'Criação de sites', niche: 'roupas e restaurantes', city: 'Curitiba', state: 'PR', country: 'BR',
    })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'NICHE_AMBIGUOUS' }) });
    expect(harness.prisma.opportunityRun.create).not.toHaveBeenCalled();
  });

  it('rejects a paid-only niche without silently replacing its category', async () => {
    const catalog = {
      ...fullCatalog,
      plan: 'FREE',
      categories: fullCatalog.categories.map((category) => ({
        ...category,
        available: category.value !== 'lawyer',
      })),
    };
    const harness = createHarness({ catalog });

    await expect(harness.service.create('org-1', 'user-1', {
      service: 'Criação de sites', niche: 'escritórios de advocacia', city: 'Curitiba', state: 'PR', country: 'BR',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.billing.assertCanCreateSearch).not.toHaveBeenCalled();
    expect(harness.prisma.opportunityRun.create).not.toHaveBeenCalled();
  });

  it('keeps legacy requests compatible by resolving the niche from service', async () => {
    const harness = createHarness();
    harness.prisma.opportunityRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'run-legacy', status: 'PREPARING', ...data,
      candidateCount: 0, analyzedCount: 0, failedCount: 0, errorCode: null, errorMessage: null,
      startedAt: now, completedAt: null, createdAt: now,
    }));

    await harness.service.create('org-1', 'user-1', {
      service: 'Marketing para restaurantes', city: 'Curitiba', state: 'PR', country: 'BR',
    });

    expect(harness.prisma.opportunityRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        service: 'Marketing para restaurantes',
        profile: expect.objectContaining({
          niche: 'Marketing para restaurantes',
          categories: ['restaurant'],
        }),
      }),
    });
  });

  it('keeps the durable run and consumed credit when Redis enqueue fails', async () => {
    const harness = createHarness();
    const now = new Date('2026-08-15T10:00:00.000Z');
    harness.prisma.opportunityRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'run-redis-down',
      status: 'PREPARING',
      ...data,
      candidateCount: 0,
      analyzedCount: 0,
      failedCount: 0,
      errorCode: null,
      errorMessage: null,
      startedAt: now,
      completedAt: null,
      createdAt: now,
    }));
    harness.queue.add.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      harness.service.create('org-1', 'user-1', {
        service: 'Marketing para restaurantes',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
      }),
    ).resolves.toMatchObject({ id: 'run-redis-down' });

    expect(harness.billing.consumeCreditForOpportunityRun).toHaveBeenCalled();
    expect(harness.billing.refundOpportunityRunCredit).not.toHaveBeenCalled();
    expect(harness.prisma.opportunityRun.delete).not.toHaveBeenCalled();
  });

  it('re-enqueues a stale Opportunity Finder run after Redis loss', async () => {
    const harness = createHarness();
    harness.prisma.opportunityRun.findMany.mockResolvedValue([
      {
        id: 'run-stale',
        status: 'SEARCHING',
        correlationId: 'corr-1',
        jobDispatchedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    harness.prisma.opportunityRun.updateMany.mockResolvedValue({ count: 1 });

    await expect(harness.service.reconcilePending()).resolves.toBe(1);
    expect(harness.metrics.recordJobRecovered).toHaveBeenCalledTimes(1);
    expect(harness.queue.add).toHaveBeenCalledWith(
      'process-opportunity-run',
      { runId: 'run-stale', correlationId: 'corr-1' },
      expect.objectContaining({ jobId: 'run-stale' }),
    );
  });

  it('locks clothing searches even when AI suggests restaurants', async () => {
    const clothingBusiness = {
      externalId: 'places/clothes-1', companyName: 'Moda Atacado', category: 'clothes',
      city: 'Curitiba', state: 'PR', country: 'BR', source: 'GOOGLE_PLACES',
      websitePresence: 'NO_WEBSITE_REPORTED', rating: 4.5, reviewCount: 20,
    };
    const restaurantBusiness = {
      externalId: 'places/restaurant-1', companyName: 'Churrascaria Central', category: 'restaurant',
      city: 'Curitiba', state: 'PR', country: 'BR', source: 'GOOGLE_PLACES',
      websitePresence: 'NO_WEBSITE_REPORTED', rating: 4.8, reviewCount: 100,
    };
    const harness = createHarness({
      providerResults: [clothingBusiness, restaurantBusiness],
      aiProfile: {
        service: 'Outra oferta', niche: 'Restaurantes', targetCustomer: ['restaurantes'],
        categories: ['restaurant'], relevantSignals: ['MISSING_WEBSITE'],
      },
      aiStrategy: {
        categories: ['restaurant'], minimumRating: null, minimumReviews: null,
        relevantSignals: ['MISSING_WEBSITE'],
      },
    });
    harness.prisma.opportunityRun.findUnique.mockResolvedValue({
      id: 'run-clothes', organizationId: 'org-1', userId: 'user-1', status: 'PREPARING',
      service: 'Criação de sites', city: 'Curitiba', state: 'PR', country: 'BR',
      profile: {
        service: 'Criação de sites', niche: 'Roupas de atacados', targetCustomer: ['Roupas de atacados'],
        categories: ['clothes'], relevantSignals: ['MISSING_WEBSITE'],
      },
    });

    await harness.service.processRun('run-clothes');

    expect(harness.ai.buildOpportunityProfile).toHaveBeenCalledWith(expect.any(Object), {
      service: 'Criação de sites', niche: 'Roupas de atacados', categories: ['clothes'],
    });
    expect(harness.provider.search).toHaveBeenCalledWith(expect.objectContaining({
      category: 'clothes', categories: ['clothes'],
    }));
    expect(harness.prisma.opportunityCandidate.upsert).toHaveBeenCalledTimes(1);
    expect(harness.prisma.opportunityCandidate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ externalId: 'places/clothes-1' }),
    }));
    expect(harness.prisma.opportunityRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        profile: expect.objectContaining({
          service: 'Criação de sites', niche: 'Roupas de atacados', categories: ['clothes'],
        }),
        searchStrategy: expect.objectContaining({ categories: ['clothes'] }),
      }),
    }));
  });

  it('records niche failures with their public code and refunds the run', async () => {
    const harness = createHarness();
    harness.prisma.opportunityRun.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      status: 'PREPARING',
    });

    await harness.service.recordFailure('run-legacy', 'NICHE_NOT_IDENTIFIED');

    expect(harness.prisma.opportunityRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'FAILED',
        errorCode: 'NICHE_NOT_IDENTIFIED',
        errorMessage: 'Não foi possível identificar o nicho informado.',
      }),
    }));
    expect(harness.billing.refundOpportunityRunCredit).toHaveBeenCalledWith(
      'org-1',
      'run-legacy',
      'NICHE_NOT_IDENTIFIED',
    );
  });
});

describe('OpportunityFinderService.saveAsLead', () => {
  function createSaveHarness() {
    const prisma = {
      opportunityRun: {
        findFirst: jest.fn().mockResolvedValue({ id: 'run-1', organizationId: 'org-1' }),
      },
      opportunityCandidate: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      lead: {
        findFirst: jest.fn(),
      },
    };
    const billing = {
      consumeCreditForSaveLead: jest.fn().mockResolvedValue(undefined),
      refundSaveLeadCredit: jest.fn().mockResolvedValue(undefined),
    };
    const leadIngestion = {
      ingest: jest.fn(),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new OpportunityFinderService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      billing as never,
      {} as never,
      leadIngestion as never,
      audit as never,
    );
    return { service, prisma, billing, leadIngestion, audit };
  }

  const candidateBase = {
    id: 'cand-1',
    runId: 'run-1',
    overallScore: 80,
    confidenceScore: 70,
    importedLeadId: null as string | null,
    company: {
      companyName: 'Loja X',
      category: 'clothes',
      phone: '+5511999999999',
      email: null,
      website: null,
      address: null,
      city: 'São Paulo',
      state: 'SP',
      postalCode: null,
      latitude: null,
      longitude: null,
      rating: 4.5,
      reviewCount: 10,
      source: 'GOOGLE_PLACES',
      externalId: 'places/1',
      websitePresence: 'NO_WEBSITE_REPORTED',
    },
  };

  it('clears a soft-deleted importedLeadId and allows a fresh save attempt', async () => {
    const harness = createSaveHarness();
    harness.prisma.opportunityCandidate.findFirst.mockResolvedValue({
      ...candidateBase,
      importedLeadId: 'lead-deleted',
    });
    harness.prisma.lead.findFirst.mockResolvedValue(null);
    harness.leadIngestion.ingest.mockResolvedValue({
      status: 'IMPORTED',
      lead: { id: 'lead-new' },
    });

    await expect(
      harness.service.saveAsLead('org-1', 'user-1', 'run-1', 'cand-1'),
    ).resolves.toEqual({ status: 'IMPORTED', leadId: 'lead-new' });

    expect(harness.prisma.opportunityCandidate.update).toHaveBeenCalledWith({
      where: { id: 'cand-1' },
      data: { importedLeadId: null },
    });
    expect(harness.billing.consumeCreditForSaveLead).toHaveBeenCalled();
    expect(harness.billing.refundSaveLeadCredit).not.toHaveBeenCalled();
  });

  it('refunds the save-lead credit when ingest returns DUPLICATE', async () => {
    const harness = createSaveHarness();
    harness.prisma.opportunityCandidate.findFirst.mockResolvedValue(candidateBase);
    harness.leadIngestion.ingest.mockResolvedValue({
      status: 'DUPLICATE',
      lead: { id: 'lead-existing', companyName: 'Loja X' },
    });

    await expect(
      harness.service.saveAsLead('org-1', 'user-1', 'run-1', 'cand-1'),
    ).resolves.toEqual({ status: 'DUPLICATE', leadId: 'lead-existing' });

    expect(harness.billing.consumeCreditForSaveLead).toHaveBeenCalled();
    expect(harness.billing.refundSaveLeadCredit).toHaveBeenCalledWith('org-1', 'cand-1');
    expect(harness.prisma.opportunityCandidate.updateMany).not.toHaveBeenCalled();
  });
});
