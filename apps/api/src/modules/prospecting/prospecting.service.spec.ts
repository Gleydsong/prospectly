import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WebsitePresence } from '@prisma/client';

import { ProspectingService } from './prospecting.service';

const searchInput = {
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

  return {
    prisma,
    queue,
    provider,
    registry,
    ingestion,
    service: new ProspectingService(prisma as never, queue as never, registry as never, ingestion as never),
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
        input: searchInput,
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
        input: europeanInput,
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

    expect(provider.search).toHaveBeenCalledWith(europeanInput);
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
