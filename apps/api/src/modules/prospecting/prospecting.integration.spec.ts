import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import { DEFAULT_SEARCH_RESULT_LIMIT } from '@prospectly/shared-types';
import request from 'supertest';

import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { initHttpIntegrationApp } from '../../common/testing/http-integration';
import { BillingService } from '../billing/billing.service';
import { LeadIngestionService } from '../leads/lead-ingestion.service';
import { MetricsService } from '../ops/metrics.service';
import {
  InMemorySearchProviderRegistry,
  OPENSTREETMAP_SEARCH_PROVIDER,
  SEARCH_PROVIDER_REGISTRY,
} from './domain/search-provider';
import { PROSPECTING_QUEUE } from './prospecting.constants';
import { ProspectingController } from './prospecting.controller';
import { ProspectingProcessor } from './prospecting.processor';
import { ProspectingService } from './prospecting.service';

const SEARCH_ID = '11111111-1111-4111-8111-111111111111';
const FOREIGN_SEARCH_ID = '22222222-2222-4222-8222-222222222222';
const RESULT_ID = '33333333-3333-4333-8333-333333333333';
const LEAD_ID = '44444444-4444-4444-8444-444444444444';

interface StoredSearch {
  id: string;
  organizationId: string;
  userId: string;
  provider?: string;
  input: Record<string, unknown>;
  status: string;
  error?: string | null;
  completedAt?: Date | null;
}

interface StoredResult {
  id: string;
  searchId: string;
  importedLeadId: string | null;
  normalizedData: Record<string, unknown>;
}

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      id?: string;
      user?: { id: string; email: string; organizationId: string; role: Role };
    }>();
    request.user = {
      id: String(request.headers['x-test-user'] ?? 'user-1'),
      email: 'integration@prospectly.test',
      organizationId: String(request.headers['x-test-org'] ?? 'org-1'),
      role: String(request.headers['x-test-role'] ?? 'MEMBER') as Role,
    };
    request.id = String(request.headers['x-correlation-id'] ?? 'corr-default');
    return true;
  }
}

function validSearchBody() {
  return { categories: ['restaurant'], city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: true };
}

describe('Prospecting HTTP integration', () => {
  let app: INestApplication;
  let service: ProspectingService;
  let processor: ProspectingProcessor;
  let searches: Map<string, StoredSearch>;
  let results: Map<string, StoredResult>;
  let queue: { add: jest.Mock };
  let provider: { search: jest.Mock };
  let ingestion: { ingest: jest.Mock };
  let metrics: { recordJob: jest.Mock; recordHttp: jest.Mock };
  let prisma: {
    search: Record<string, jest.Mock>;
    searchResult: Record<string, jest.Mock>;
    organization: Record<string, jest.Mock>;
    lead: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    searches = new Map();
    results = new Map();
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    provider = { search: jest.fn() };
    ingestion = { ingest: jest.fn() };
    metrics = { recordJob: jest.fn(), recordHttp: jest.fn() };

    prisma = {
      search: {
        create: jest.fn(async ({ data }: { data: Omit<StoredSearch, 'id'> }) => {
          const record = { id: SEARCH_ID, ...data };
          searches.set(record.id, record);
          return record;
        }),
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(async ({ where }: { where: { id: string; organizationId: string } }) => {
          const record = searches.get(where.id);
          return record?.organizationId === where.organizationId ? record : null;
        }),
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) => searches.get(where.id) ?? null,
        ),
        update: jest.fn(
          async ({ where, data }: { where: { id: string }; data: Partial<StoredSearch> }) => {
            const current = searches.get(where.id);
            if (!current) return null;
            const updated = { ...current, ...data };
            searches.set(where.id, updated);
            return updated;
          },
        ),
        delete: jest.fn(async ({ where }: { where: { id: string } }) => {
          const current = searches.get(where.id);
          if (!current) return null;
          searches.delete(where.id);
          for (const [resultId, result] of results) {
            if (result.searchId === where.id) results.delete(resultId);
          }
          return current;
        }),
      },
      searchResult: {
        count: jest.fn(),
        findMany: jest.fn(
          async ({ where }: { where: { searchId: string; id?: { in: string[] } } }) =>
            [...results.values()].filter(
              (result) =>
                result.searchId === where.searchId &&
                (!where.id || where.id.in.includes(result.id)),
            ),
        ),
        upsert: jest.fn(
          async ({
            create,
          }: {
            create: {
              searchId: string;
              externalId: string;
              normalizedData: Record<string, unknown>;
            };
          }) => {
            const id = RESULT_ID;
            const record = {
              id,
              searchId: create.searchId,
              importedLeadId: null as string | null,
              normalizedData: create.normalizedData,
            };
            results.set(id, record);
            return record;
          },
        ),
        deleteMany: jest.fn(),
        updateMany: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string; importedLeadId?: string | null };
            data: { importedLeadId: string | null };
          }) => {
            const result = results.get(where.id);
            if (!result) return { count: 0 };
            if (
              where.importedLeadId !== undefined &&
              result.importedLeadId !== where.importedLeadId
            ) {
              return { count: 0 };
            }
            results.set(where.id, { ...result, importedLeadId: data.importedLeadId });
            return { count: 1 };
          },
        ),
      },
      organization: {
        findFirst: jest.fn(async () => ({ plan: 'LIFETIME', planStatus: 'ACTIVE' })),
      },
      lead: {
        findFirst: jest.fn(
          async ({ where }: { where: { id: string; organizationId: string; deletedAt: null } }) => {
            const linked = [...results.values()].some(
              (result) => result.importedLeadId === where.id,
            );
            return linked ? { id: where.id } : null;
          },
        ),
      },
      $transaction: jest.fn(async (work: unknown) => {
        if (typeof work === 'function') {
          return (work as (client: typeof prisma) => Promise<unknown>)(prisma);
        }
        return Promise.all(work as Promise<unknown>[]);
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [ProspectingController],
      providers: [
        ProspectingService,
        ProspectingProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(PROSPECTING_QUEUE), useValue: queue },
        { provide: OPENSTREETMAP_SEARCH_PROVIDER, useValue: provider },
        {
          provide: SEARCH_PROVIDER_REGISTRY,
          useValue: new InMemorySearchProviderRegistry([
            { id: 'OPENSTREETMAP', label: 'OpenStreetMap', provider },
            { id: 'GOOGLE_PLACES', label: 'Google Places', provider: null },
          ]),
        },
        { provide: LeadIngestionService, useValue: ingestion },
        {
          provide: BillingService,
          useValue: {
            assertCanCreateSearch: jest.fn().mockResolvedValue(undefined),
            refundSearchCredit: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: MetricsService, useValue: metrics },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
      }),
    );
    app.useGlobalGuards(new HeaderAuthGuard(), new RolesGuard(module.get(Reflector)));
    await initHttpIntegrationApp(app);

    service = module.get(ProspectingService);
    processor = module.get(ProspectingProcessor);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('forbids VIEWER writes before a search or queue job is created', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .set('x-test-role', 'VIEWER')
      .send(validSearchBody())
      .expect(403);

    expect(prisma.search.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('deletes an owned search and forbids cross-org deletion', async () => {
    searches.set(SEARCH_ID, {
      id: SEARCH_ID,
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'OPENSTREETMAP',
      input: validSearchBody(),
      status: 'FAILED',
    });
    searches.set(FOREIGN_SEARCH_ID, {
      id: FOREIGN_SEARCH_ID,
      organizationId: 'org-2',
      userId: 'user-2',
      provider: 'OPENSTREETMAP',
      input: validSearchBody(),
      status: 'COMPLETED',
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/searches/${SEARCH_ID}`)
      .set('x-test-org', 'org-1')
      .expect(204);
    expect(searches.has(SEARCH_ID)).toBe(false);

    await request(app.getHttpServer())
      .delete(`/api/v1/searches/${FOREIGN_SEARCH_ID}`)
      .set('x-test-org', 'org-1')
      .expect(404);
    expect(searches.has(FOREIGN_SEARCH_ID)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/searches/${SEARCH_ID}`)
      .set('x-test-role', 'VIEWER')
      .expect(403);
  });

  it('propagates the request correlation id into the durable search job', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .set('x-correlation-id', 'corr-search-1')
      .send(validSearchBody())
      .expect(202);

    expect(queue.add).toHaveBeenCalledWith(
      'run-search',
      { searchId: SEARCH_ID, correlationId: 'corr-search-1' },
      expect.objectContaining({ jobId: SEARCH_ID }),
    );
  });

  it('rejects blank search terms and non-boolean filter values before persistence', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({ categories: ['   '], city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({ categories: ['restaurante'], city: '   ', state: 'SP', country: 'BR', onlyWithoutWebsite: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({ categories: ['restaurante'], city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: 'sometimes' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({ categories: ['categoria-livre'], city: 'São Paulo', state: 'SP', country: 'BR', onlyWithoutWebsite: true })
      .expect(400);

    expect(prisma.search.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('defaults country to BR and rejects non-BR countries and invalid BR regions', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({ categories: ['restaurant'], city: 'São Paulo', state: 'SP', onlyWithoutWebsite: true })
      .expect(202);

    expect(prisma.search.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          input: expect.objectContaining({ country: 'BR', state: 'SP' }),
        }),
      }),
    );

    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({
        categories: ['restaurant'],
        country: 'PT',
        city: 'Lisboa',
        state: 'Lisboa',
        onlyWithoutWebsite: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({
        categories: ['restaurant'],
        country: 'BR',
        city: 'São Paulo',
        state: 'São Paulo',
        onlyWithoutWebsite: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/v1/searches')
      .send({
        categories: ['restaurant'],
        country: 'US',
        city: 'New York',
        state: 'NY',
        onlyWithoutWebsite: true,
      })
      .expect(400);
  });

  it('processes a Brazilian search end-to-end and imports with country BR', async () => {
    searches.set(SEARCH_ID, {
      id: SEARCH_ID,
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'OPENSTREETMAP',
      input: {
        category: 'restaurant',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
        onlyWithoutWebsite: true,
      },
      status: 'PENDING',
    });
    provider.search.mockResolvedValue([
      {
        externalId: 'node/br-1',
        companyName: 'Café Batel',
        city: 'Curitiba',
        state: 'PR',
        country: 'BR',
        phone: '+55 41 3000 0000',
        source: 'OPENSTREETMAP',
        websitePresence: 'NO_WEBSITE_REPORTED',
      },
    ]);

    await processor.process({
      data: { searchId: SEARCH_ID },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as never);

    expect(provider.search).toHaveBeenCalledWith({
      category: 'restaurant',
      categories: ['restaurant'],
      city: 'Curitiba',
      state: 'PR',
      country: 'BR',
      onlyWithoutWebsite: true,
      limit: DEFAULT_SEARCH_RESULT_LIMIT,
    });
    expect(searches.get(SEARCH_ID)?.status).toBe('COMPLETED');

    const storedResult = [...results.values()][0];
    expect(storedResult?.normalizedData).toEqual(
      expect.objectContaining({ country: 'BR', city: 'Curitiba', state: 'PR' }),
    );

    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: LEAD_ID } });
    await request(app.getHttpServer())
      .post(`/api/v1/searches/${SEARCH_ID}/import`)
      .send({ resultIds: [storedResult!.id] })
      .expect(201);

    expect(ingestion.ingest).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      expect.objectContaining({
        companyName: 'Café Batel',
        country: 'BR',
        city: 'Curitiba',
        state: 'PR',
      }),
    );
  });

  it('returns 404 for another organization and rejects malformed UUIDs before lookup', async () => {
    searches.set(FOREIGN_SEARCH_ID, {
      id: FOREIGN_SEARCH_ID,
      organizationId: 'org-2',
      userId: 'user-2',
      input: validSearchBody(),
      status: 'COMPLETED',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/searches/${FOREIGN_SEARCH_ID}`)
      .set('x-test-org', 'org-1')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/searches/not-a-uuid')
      .set('x-test-org', 'org-1')
      .expect(400);

    expect(prisma.search.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.search.findFirst).toHaveBeenCalledWith({
      where: { id: FOREIGN_SEARCH_ID, organizationId: 'org-1' },
    });
  });

  it('imports an owned result only once across repeated HTTP requests', async () => {
    searches.set(SEARCH_ID, {
      id: SEARCH_ID,
      organizationId: 'org-1',
      userId: 'user-1',
      input: validSearchBody(),
      status: 'COMPLETED',
    });
    results.set(RESULT_ID, {
      id: RESULT_ID,
      searchId: SEARCH_ID,
      importedLeadId: null,
      normalizedData: {
        externalId: 'node/1',
        companyName: 'Restaurante Bom',
        city: 'São Paulo',
        state: 'SP',
        country: 'BR',
        source: 'OPENSTREETMAP',
        websitePresence: 'NO_WEBSITE_REPORTED',
      },
    });
    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: LEAD_ID } });

    const first = await request(app.getHttpServer())
      .post(`/api/v1/searches/${SEARCH_ID}/import`)
      .send({ resultIds: [RESULT_ID] })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/searches/${SEARCH_ID}/import`)
      .send({ resultIds: [RESULT_ID] })
      .expect(201);

    expect(first.body).toEqual({
      imported: 1,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [
        {
          resultId: RESULT_ID,
          status: 'IMPORTED',
          leadId: LEAD_ID,
          companyName: 'Restaurante Bom',
        },
      ],
    });
    expect(second.body).toEqual({
      imported: 0,
      skipped: 1,
      invalid: 0,
      conflicts: 0,
      items: [{ resultId: RESULT_ID, status: 'SKIPPED', leadId: LEAD_ID }],
    });
    expect(ingestion.ingest).toHaveBeenCalledTimes(1);
    expect(ingestion.ingest).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Object));
  });

  it('sanitizes a provider failure at the final processor attempt', async () => {
    searches.set(SEARCH_ID, {
      id: SEARCH_ID,
      organizationId: 'org-1',
      userId: 'user-1',
      provider: 'OPENSTREETMAP',
      input: validSearchBody(),
      status: 'PENDING',
    });
    provider.search.mockRejectedValue(new Error('Authorization=secret-token upstream body'));

    await expect(
      processor.process({
        data: { searchId: SEARCH_ID },
        attemptsMade: 2,
        opts: { attempts: 3 },
      } as never),
    ).rejects.toThrow('Search processing failed. Please try again later.');

    const persisted = await service.get('org-1', SEARCH_ID);
    expect(persisted).toEqual(
      expect.objectContaining({
        status: 'FAILED',
        error: 'Search provider is temporarily unavailable. Please try again later.',
      }),
    );
    expect(JSON.stringify(persisted)).not.toContain('secret-token');
    expect(metrics.recordJob).toHaveBeenCalledWith(PROSPECTING_QUEUE, 'failed', expect.any(Number));
  });
});
