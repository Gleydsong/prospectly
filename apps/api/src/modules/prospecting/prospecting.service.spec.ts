import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WebsitePresence } from '@prisma/client';
import { DEFAULT_SEARCH_RESULT_LIMIT } from '@prospectly/shared-types';

import { ProspectingService } from './prospecting.service';

const searchInput = {
  categories: ['restaurant' as const],
  category: 'restaurant' as const,
  city: 'São Paulo',
  state: 'SP' as const,
  country: 'BR' as const,
  onlyWithoutWebsite: true,
};

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    search: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    searchResult: {
      count: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue({ plan: 'LIFETIME', planStatus: 'ACTIVE' }),
    },
    $transaction: jest.fn(),
    ...overrides,
  };
  prisma.$transaction.mockImplementation(async (work: unknown) => {
    if (typeof work === 'function') return work(prisma);
    return Promise.all(work as Promise<unknown>[]);
  });
  const queue = { add: jest.fn() };
  const provider = { search: jest.fn() };
  const registry = {
    list: jest.fn(() => [{ id: 'OPENSTREETMAP', label: 'OpenStreetMap', available: true }]),
    isAvailable: jest.fn((id: string) => id === 'OPENSTREETMAP'),
    resolve: jest.fn(() => provider),
  };
  const ingestion = { ingest: jest.fn() };
  const billing = { assertCanCreateSearch: jest.fn().mockResolvedValue(undefined) };

  return {
    prisma,
    queue,
    provider,
    registry,
    ingestion,
    billing,
    service: new ProspectingService(
      prisma as never,
      queue as never,
      registry as never,
      ingestion as never,
      billing as never,
    ),
  };
}

describe('ProspectingService', () => {
  it('creates a pending search and queues a durable job using the search id', async () => {
    const { prisma, queue, service } = createService();
    const search = { id: 'search-1', status: 'PENDING' };
    prisma.search.create.mockResolvedValue(search);
    queue.add.mockResolvedValue(undefined);

    await expect(service.create('org-1', 'user-1', searchInput)).resolves.toEqual(search);

    expect(prisma.search.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        provider: 'OPENSTREETMAP',
        input: { ...searchInput, limit: DEFAULT_SEARCH_RESULT_LIMIT },
        status: 'PENDING',
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'run-search',
      { searchId: 'search-1' },
      expect.objectContaining({ jobId: 'search-1', attempts: 3 }),
    );
  });

  it('persists European country and free-text region on create, then passes them to the provider', async () => {
    const { prisma, queue, provider, service } = createService();
    const europeanInput = {
      categories: ['restaurant' as const],
      category: 'restaurant' as const,
      city: 'Lisboa',
      state: 'Lisboa',
      country: 'PT' as const,
      onlyWithoutWebsite: true,
    };
    prisma.search.create.mockResolvedValue({ id: 'search-pt', status: 'PENDING' });
    queue.add.mockResolvedValue(undefined);

    await service.create('org-1', 'user-1', europeanInput);

    expect(prisma.search.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        input: { ...europeanInput, limit: DEFAULT_SEARCH_RESULT_LIMIT },
      }),
    });

    prisma.search.findUnique.mockResolvedValue({
      id: 'search-pt',
      organizationId: 'org-1',
      provider: 'OPENSTREETMAP',
      input: europeanInput,
    });
    provider.search.mockResolvedValue([
      {
        externalId: 'node/pt-1',
        companyName: 'Tasca Lisboa',
        city: 'Lisboa',
        state: 'Lisboa',
        country: 'PT',
        source: 'OPENSTREETMAP',
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
      },
    ]);

    await service.process('search-pt');

    expect(provider.search).toHaveBeenCalledWith({
      ...europeanInput,
      limit: DEFAULT_SEARCH_RESULT_LIMIT,
    });
    expect(prisma.searchResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { searchId_externalId: { searchId: 'search-pt', externalId: 'node/pt-1' } },
      }),
    );
  });

  it('keeps a failed dispatch recoverable and republishes it idempotently', async () => {
    const { prisma, queue, service } = createService();
    const search = { id: 'search-1', status: 'PENDING', correlationId: 'corr-1' };
    prisma.search.create.mockResolvedValue(search);
    queue.add.mockRejectedValue(new Error('redis password=super-secret unavailable'));

    await expect(service.create('org-1', 'user-1', searchInput, 'corr-1')).resolves.toEqual(search);

    expect(prisma.search.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );

    prisma.search.findMany.mockResolvedValue([search]);
    prisma.search.updateMany.mockResolvedValue({ count: 1 });
    queue.add.mockResolvedValue(undefined);
    await service.reconcilePending();

    expect(queue.add).toHaveBeenLastCalledWith(
      'run-search',
      { searchId: 'search-1', correlationId: 'corr-1' },
      expect.objectContaining({ jobId: 'search-1' }),
    );
    expect(prisma.search.updateMany).toHaveBeenCalledWith({
      where: { id: 'search-1', status: 'PENDING', jobDispatchedAt: null },
      data: { jobDispatchedAt: expect.any(Date) },
    });
  });

  it('rejects unavailable Google Places provider when key is missing', async () => {
    const { prisma, registry, service } = createService();
    registry.isAvailable.mockReturnValue(false);

    await expect(
      service.create('org-1', 'user-1', { ...searchInput, provider: 'GOOGLE_PLACES' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.search.create).not.toHaveBeenCalled();
  });

  it('rejects a category that the free plan does not unlock', async () => {
    const { prisma, service } = createService();
    prisma.organization.findFirst.mockResolvedValue({ plan: 'FREE', planStatus: 'INACTIVE' });

    await expect(
      service.create('org-1', 'user-1', { ...searchInput, categories: ['lawyer' as const] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.search.create).not.toHaveBeenCalled();
  });

  it('accepts a free category and keeps the search on the free plan', async () => {
    const { prisma, service } = createService();
    prisma.organization.findFirst.mockResolvedValue({ plan: 'FREE', planStatus: 'INACTIVE' });
    prisma.search.create.mockResolvedValue({ id: 'search-free', status: 'PENDING' });

    await expect(
      service.create('org-1', 'user-1', { ...searchInput, categories: ['bakery' as const] }),
    ).resolves.toEqual({ id: 'search-free', status: 'PENDING' });
  });

  it('marks paid-only categories as unavailable in the free catalog', async () => {
    const { prisma, service } = createService();
    prisma.organization.findFirst.mockResolvedValue({ plan: 'FREE', planStatus: 'INACTIVE' });

    const catalog = await service.listCategories('org-1');

    expect(catalog.plan).toBe('FREE');
    expect(catalog.availableCount).toBe(5);
    expect(catalog.categories).toContainEqual({
      value: 'restaurant',
      label: 'Restaurante',
      available: true,
    });
    expect(catalog.categories).toContainEqual({
      value: 'lawyer',
      label: 'Advocacia',
      available: false,
    });
  });

  it('persists the neighborhood and caps persisted results at the requested volume', async () => {
    const { prisma, provider, service } = createService();
    const input = { ...searchInput, neighborhood: 'Casa Caiada', limit: 20 as const };
    prisma.search.create.mockResolvedValue({ id: 'search-1', status: 'PENDING' });

    await service.create('org-1', 'user-1', input);

    expect(prisma.search.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        input: expect.objectContaining({ neighborhood: 'Casa Caiada', limit: 20 }),
      }),
    });

    prisma.search.findUnique.mockResolvedValue({
      id: 'search-1',
      organizationId: 'org-1',
      provider: 'OPENSTREETMAP',
      input: { ...input, limit: 20 },
    });
    prisma.search.update.mockResolvedValue(undefined);
    provider.search.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) => ({
        externalId: `node/${index}`,
        companyName: `Empresa ${index}`,
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
      })),
    );

    await service.process('search-1');

    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({ neighborhood: 'Casa Caiada', limit: 20 }),
    );
    expect(prisma.searchResult.upsert).toHaveBeenCalledTimes(20);
  });

  it('lists only available providers', () => {
    const { registry, service } = createService();
    registry.list.mockReturnValue([
      { id: 'OPENSTREETMAP', label: 'OpenStreetMap', available: true },
      { id: 'GOOGLE_PLACES', label: 'Google Places', available: false },
    ]);

    expect(service.listProviders()).toEqual([
      { id: 'OPENSTREETMAP', label: 'OpenStreetMap', available: true },
    ]);
  });

  it('scopes search history and pagination to the current organization', async () => {
    const { prisma, service } = createService();
    prisma.$transaction.mockResolvedValue([1, [{ id: 'search-1' }]]);

    await expect(service.list('org-1', { page: 2, pageSize: 10 })).resolves.toEqual({
      data: [{ id: 'search-1' }],
      meta: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });

    expect(prisma.search.count).toHaveBeenCalledWith({ where: { organizationId: 'org-1' } });
    expect(prisma.search.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' }, skip: 10, take: 10 }),
    );
  });

  it('hides a search owned by another organization', async () => {
    const { prisma, service } = createService();
    prisma.search.findFirst.mockResolvedValue(null);

    await expect(service.get('org-1', 'search-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.search.findFirst).toHaveBeenCalledWith({
      where: { id: 'search-2', organizationId: 'org-1' },
    });
  });

  it('removes an owned search after scoping by organization', async () => {
    const { prisma, service } = createService();
    prisma.search.findFirst.mockResolvedValue({ id: 'search-1', organizationId: 'org-1' });
    prisma.search.delete.mockResolvedValue({ id: 'search-1' });

    await expect(service.remove('org-1', 'search-1')).resolves.toBeUndefined();
    expect(prisma.search.findFirst).toHaveBeenCalledWith({
      where: { id: 'search-1', organizationId: 'org-1' },
    });
    expect(prisma.search.delete).toHaveBeenCalledWith({ where: { id: 'search-1' } });
  });

  it('does not delete a search from another organization', async () => {
    const { prisma, service } = createService();
    prisma.search.findFirst.mockResolvedValue(null);

    await expect(service.remove('org-1', 'search-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.search.delete).not.toHaveBeenCalled();
  });

  it('transitions a queued search, persists provider results idempotently and completes it', async () => {
    const { prisma, provider, service } = createService();
    prisma.search.findUnique.mockResolvedValue({
      id: 'search-1',
      organizationId: 'org-1',
      provider: 'OPENSTREETMAP',
      input: searchInput,
    });
    prisma.search.update.mockResolvedValue(undefined);
    provider.search.mockResolvedValue([
      {
        externalId: 'node/1',
        companyName: 'Restaurante Bom',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
      },
    ]);

    await service.process('search-1');

    expect(prisma.search.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'search-1' },
      data: { status: 'PROCESSING', error: null, completedAt: null },
    });
    expect(provider.search).toHaveBeenCalledWith(expect.objectContaining({ category: 'restaurant' }));
    expect(prisma.searchResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { searchId_externalId: { searchId: 'search-1', externalId: 'node/1' } },
      }),
    );
    expect(prisma.searchResult.deleteMany).toHaveBeenCalledWith({
      where: { searchId: 'search-1', externalId: { notIn: ['node/1'] } },
    });
    expect(prisma.search.update).toHaveBeenLastCalledWith({
      where: { id: 'search-1' },
      data: { status: 'COMPLETED', error: null, completedAt: expect.any(Date) },
    });
  });

  it('runs the provider once with all categories and deduplicates by externalId', async () => {
    const { prisma, provider, service } = createService();
    prisma.search.findUnique.mockResolvedValue({
      id: 'search-multi',
      organizationId: 'org-1',
      provider: 'OPENSTREETMAP',
      input: {
        categories: ['restaurant', 'bakery'],
        category: 'restaurant',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        onlyWithoutWebsite: false,
      },
    });
    prisma.search.update.mockResolvedValue(undefined);
    provider.search.mockResolvedValue([
      {
        externalId: 'node/1',
        companyName: 'Restaurante',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
        websitePresence: WebsitePresence.WEBSITE_FOUND,
      },
      {
        externalId: 'node/shared',
        companyName: 'Misto',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
      },
      {
        externalId: 'node/2',
        companyName: 'Padaria',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
        websitePresence: WebsitePresence.WEBSITE_FOUND,
      },
    ]);

    await service.process('search-multi');

    expect(provider.search).toHaveBeenCalledTimes(1);
    expect(provider.search).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'restaurant',
        categories: ['restaurant', 'bakery'],
      }),
    );
    expect(prisma.searchResult.upsert).toHaveBeenCalledTimes(3);
  });

  it('records only a sanitized failure after a provider error reaches its final attempt', async () => {
    const { prisma, provider, service } = createService();
    prisma.search.findUnique.mockResolvedValue({
      id: 'search-1',
      organizationId: 'org-1',
      provider: 'OPENSTREETMAP',
      input: searchInput,
    });
    provider.search.mockRejectedValue(new Error('token=super-secret provider response'));

    await expect(service.process('search-1')).rejects.toThrow('token=super-secret provider response');
    await service.recordFailure('search-1');

    expect(prisma.search.update).toHaveBeenLastCalledWith({
      where: { id: 'search-1' },
      data: {
        status: 'FAILED',
        error: 'Search provider is temporarily unavailable. Please try again later.',
        completedAt: expect.any(Date),
      },
    });
  });

  it('imports only selected results belonging to the owned search and links imported leads', async () => {
    const { prisma, ingestion, service } = createService();
    prisma.search.findFirst.mockResolvedValue({ id: 'search-1', organizationId: 'org-1', status: 'COMPLETED' });
    prisma.searchResult.findMany.mockResolvedValue([
      {
        id: 'result-1',
        importedLeadId: null,
        normalizedData: {
          externalId: 'node/1',
          companyName: 'Restaurante Bom',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          source: 'OPENSTREETMAP',
          websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
        },
      },
    ]);
    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: 'lead-1' } });
    prisma.searchResult.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.importResults('org-1', 'user-1', 'search-1', ['result-1'])).resolves.toEqual({
      imported: 1,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [
        expect.objectContaining({
          resultId: 'result-1',
          status: 'IMPORTED',
          leadId: 'lead-1',
          companyName: 'Restaurante Bom',
        }),
      ],
    });

    expect(ingestion.ingest).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      expect.objectContaining({
        source: 'OPENSTREETMAP',
        status: 'TO_REVIEW',
        tags: ['sem-site'],
        websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
      }),
    );
    expect(prisma.searchResult.updateMany).toHaveBeenCalledWith({
      where: { id: 'result-1', importedLeadId: null },
      data: { importedLeadId: 'lead-1' },
    });
  });

  it('does not tag sem-site when the source reported a website', async () => {
    const { prisma, ingestion, service } = createService();
    prisma.search.findFirst.mockResolvedValue({
      id: 'search-1',
      organizationId: 'org-1',
      status: 'COMPLETED',
    });
    prisma.searchResult.findMany.mockResolvedValue([
      {
        id: 'result-2',
        importedLeadId: null,
        normalizedData: {
          externalId: 'osm-2',
          companyName: 'Padaria Com Site',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          source: 'OPENSTREETMAP',
          website: 'https://padaria.example',
          websitePresence: WebsitePresence.WEBSITE_FOUND,
        },
      },
    ]);
    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: 'lead-2' } });
    prisma.searchResult.updateMany.mockResolvedValue({ count: 1 });

    await service.importResults('org-1', 'user-1', 'search-1', ['result-2']);

    expect(ingestion.ingest).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      expect.objectContaining({
        websitePresence: WebsitePresence.WEBSITE_FOUND,
        tags: [],
        confidenceLevel: 'MEDIUM',
      }),
    );
  });

  it('rejects imports while the owned search is not completed', async () => {
    const { prisma, ingestion, service } = createService();
    prisma.search.findFirst.mockResolvedValue({
      id: 'search-1',
      organizationId: 'org-1',
      status: 'PROCESSING',
    });

    await expect(
      service.importResults('org-1', 'user-1', 'search-1', ['result-1']),
    ).rejects.toThrow('Search must be completed before importing results');

    expect(prisma.searchResult.findMany).not.toHaveBeenCalled();
    expect(ingestion.ingest).not.toHaveBeenCalled();
  });

  it('recovers a result-to-lead link after an interrupted import returns a strong duplicate', async () => {
    const { prisma, ingestion, service } = createService();
    prisma.search.findFirst.mockResolvedValue({ id: 'search-1', organizationId: 'org-1', status: 'COMPLETED' });
    prisma.searchResult.findMany.mockResolvedValue([
      {
        id: 'result-1',
        importedLeadId: null,
        normalizedData: {
          externalId: 'node/1',
          companyName: 'Restaurante Bom',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          source: 'OPENSTREETMAP',
          websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
        },
      },
    ]);
    ingestion.ingest.mockResolvedValue({ status: 'DUPLICATE', lead: { id: 'lead-existing' } });
    prisma.searchResult.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.importResults('org-1', 'user-1', 'search-1', ['result-1'])).resolves.toEqual({
      imported: 0,
      skipped: 1,
      invalid: 0,
      conflicts: 0,
      items: [
        expect.objectContaining({
          resultId: 'result-1',
          status: 'SKIPPED',
          leadId: 'lead-existing',
        }),
      ],
    });

    expect(prisma.searchResult.updateMany).toHaveBeenCalledWith({
      where: { id: 'result-1', importedLeadId: null },
      data: { importedLeadId: 'lead-existing' },
    });
  });

  it('does not report an imported result when a concurrent request wins the link', async () => {
    const { prisma, ingestion, service } = createService();
    prisma.search.findFirst.mockResolvedValue({ id: 'search-1', organizationId: 'org-1', status: 'COMPLETED' });
    prisma.searchResult.findMany.mockResolvedValue([
      {
        id: 'result-1',
        importedLeadId: null,
        normalizedData: {
          externalId: 'node/1',
          companyName: 'Restaurante Bom',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
          source: 'OPENSTREETMAP',
          websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
        },
      },
    ]);
    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: 'lead-1' } });
    prisma.searchResult.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.importResults('org-1', 'user-1', 'search-1', ['result-1'])).resolves.toEqual({
      imported: 0,
      skipped: 1,
      invalid: 0,
      conflicts: 0,
      items: [
        expect.objectContaining({
          resultId: 'result-1',
          status: 'SKIPPED',
          leadId: 'lead-1',
          companyName: 'Restaurante Bom',
        }),
      ],
    });
  });

  it('rejects a result id that is not part of the owned search', async () => {
    const { prisma, service } = createService();
    prisma.search.findFirst.mockResolvedValue({ id: 'search-1', organizationId: 'org-1', status: 'COMPLETED' });
    prisma.searchResult.findMany.mockResolvedValue([]);

    await expect(service.importResults('org-1', 'user-1', 'search-1', ['foreign-result'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
