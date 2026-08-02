import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma, type Role } from '@prisma/client';
import request from 'supertest';

import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../common/prisma/prisma.service';
import { initHttpIntegrationApp } from '../../common/testing/http-integration';
import { AuditService } from '../audit/audit.service';
import { LeadIngestionService } from '../leads/lead-ingestion.service';
import { CsvParserService } from './csv-parser.service';
import { IMPORTS_QUEUE, type ProcessCsvImportJobData } from './imports.constants';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

const IMPORT_ID = '55555555-5555-4555-8555-555555555555';
const FOREIGN_IMPORT_ID = '66666666-6666-4666-8666-666666666666';

interface StoredImport {
  id: string;
  organizationId: string;
  userId: string;
  fileName: string;
  status: string;
  totalRows: number;
  mapping: Record<string, string>;
  stagedRows?: Array<Record<string, string>>;
  correlationId?: string | null;
  jobDispatchedAt?: Date | null;
  importedCount?: number;
  skippedCount?: number;
  invalidCount?: number;
  completedAt?: Date | null;
  createdAt?: Date;
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

describe('CSV imports HTTP and worker integration', () => {
  let app: INestApplication;
  let service: ImportsService;
  let imports: Map<string, StoredImport>;
  let queue: { add: jest.Mock };
  let ingestion: { ingest: jest.Mock };
  let audit: { log: jest.Mock };
  let prisma: {
    import: Record<string, jest.Mock>;
    importError: Record<string, jest.Mock>;
    lead: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    imports = new Map();
    queue = { add: jest.fn().mockResolvedValue(undefined) };
    ingestion = { ingest: jest.fn() };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    prisma = {
      import: {
        create: jest.fn(async ({ data }: { data: Omit<StoredImport, 'id'> }) => {
          const record = { id: IMPORT_ID, ...data };
          imports.set(record.id, record);
          return record;
        }),
        count: jest.fn(async () => imports.size),
        findMany: jest.fn(async () => [...imports.values()]),
        findFirst: jest.fn(async ({ where }: { where: { id: string; organizationId: string } }) => {
          const record = imports.get(where.id);
          return record?.organizationId === where.organizationId ? record : null;
        }),
        findUnique: jest.fn(
          async ({ where }: { where: { id: string } }) => imports.get(where.id) ?? null,
        ),
        update: jest.fn(
          async ({ where, data }: { where: { id: string }; data: Partial<StoredImport> }) => {
            const current = imports.get(where.id);
            if (!current) return null;
            const updated = { ...current, ...data };
            imports.set(where.id, updated);
            return updated;
          },
        ),
      },
      importError: {
        count: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      lead: { findFirst: jest.fn() },
      $transaction: jest.fn(async (work: unknown) => Promise.all(work as Promise<unknown>[])),
    };

    const module = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        ImportsService,
        CsvParserService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(IMPORTS_QUEUE), useValue: queue },
        { provide: LeadIngestionService, useValue: ingestion },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(10_000) } },
        { provide: AuditService, useValue: audit },
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
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalGuards(new HeaderAuthGuard(), new RolesGuard(module.get(Reflector)));
    await initHttpIntegrationApp(app);

    service = module.get(ImportsService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('forbids VIEWER uploads before parsing or queueing the CSV', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/imports/csv')
      .set('x-test-role', 'VIEWER')
      .field('mapping', JSON.stringify({ companyName: 'Empresa' }))
      .attach('file', Buffer.from('Empresa\nAcme Ltda'), 'leads.csv')
      .expect(403);

    expect(prisma.import.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('returns 404 for another organization and rejects malformed UUIDs before lookup', async () => {
    imports.set(FOREIGN_IMPORT_ID, {
      id: FOREIGN_IMPORT_ID,
      organizationId: 'org-2',
      userId: 'user-2',
      fileName: 'foreign.csv',
      status: 'COMPLETED',
      totalRows: 1,
      mapping: { companyName: 'Empresa' },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/imports/${FOREIGN_IMPORT_ID}`)
      .set('x-test-org', 'org-1')
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/imports/not-a-uuid')
      .set('x-test-org', 'org-1')
      .expect(400);

    expect(prisma.import.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.import.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: FOREIGN_IMPORT_ID, organizationId: 'org-1' },
      select: expect.any(Object),
    }));
  });

  it('returns only the public import contract from history and detail endpoints', async () => {
    imports.set(IMPORT_ID, {
      id: IMPORT_ID,
      organizationId: 'org-1',
      userId: 'user-1',
      fileName: 'private-contacts.csv',
      status: 'PENDING',
      totalRows: 1,
      importedCount: 0,
      skippedCount: 0,
      invalidCount: 0,
      mapping: { companyName: 'Empresa', email: 'Email' },
      stagedRows: [{ Empresa: 'Cliente privado', Email: 'private@example.test' }],
      correlationId: 'corr-internal',
      jobDispatchedAt: new Date('2026-07-22T10:00:01.000Z'),
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      completedAt: null,
    });

    const history = await request(app.getHttpServer())
      .get('/api/v1/imports?page=1&pageSize=20')
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/imports/${IMPORT_ID}`)
      .expect(200);

    expect(history.body.data).toHaveLength(1);
    for (const record of [history.body.data[0], detail.body]) {
      expect(record).toEqual(expect.objectContaining({ id: IMPORT_ID, fileName: 'private-contacts.csv' }));
      expect(record).not.toHaveProperty('stagedRows');
      expect(record).not.toHaveProperty('organizationId');
      expect(record).not.toHaveProperty('userId');
      expect(record).not.toHaveProperty('correlationId');
      expect(record).not.toHaveProperty('jobDispatchedAt');
      expect(JSON.stringify(record)).not.toContain('private@example.test');
    }
  });

  it('uses persisted JWT identity and keeps counters stable when the same job is processed twice', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/imports/csv')
      .set('x-test-org', 'org-1')
      .set('x-test-user', 'user-1')
      .set('x-correlation-id', 'corr-import-1')
      .field('mapping', JSON.stringify({ companyName: 'Empresa' }))
      .attach('file', Buffer.from('Empresa\nAcme Ltda'), 'leads.csv');

    expect({ status: response.status, body: response.body }).toEqual({
      status: 202,
      body: expect.objectContaining({ id: IMPORT_ID }),
    });
    expect(response.body).not.toHaveProperty('stagedRows');
    expect(response.body).not.toHaveProperty('organizationId');
    expect(response.body).not.toHaveProperty('userId');
    expect(response.body).not.toHaveProperty('correlationId');
    expect(response.body).not.toHaveProperty('jobDispatchedAt');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'import.started',
        entity: 'Import',
        entityId: IMPORT_ID,
        metadata: expect.objectContaining({
          fileName: 'leads.csv',
          totalRows: 1,
        }),
      }),
    );

    const queued = queue.add.mock.calls[0]?.[1] as ProcessCsvImportJobData;
    expect(queued).toEqual({ importId: IMPORT_ID, correlationId: 'corr-import-1' });
    const tamperedJob = { ...queued, organizationId: 'org-attacker', userId: 'user-attacker' };
    ingestion.ingest
      .mockResolvedValueOnce({ status: 'IMPORTED', lead: { id: 'lead-1' } })
      .mockResolvedValueOnce({ status: 'DUPLICATE', lead: { id: 'lead-1' } });
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });

    await service.process(tamperedJob);
    await service.process(tamperedJob);

    expect(ingestion.ingest).toHaveBeenCalledTimes(1);
    expect(ingestion.ingest).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Object));
    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
    expect(imports.get(IMPORT_ID)).toEqual(
      expect.objectContaining({
        status: 'COMPLETED',
        importedCount: 1,
        skippedCount: 0,
        invalidCount: 0,
        stagedRows: Prisma.DbNull,
      }),
    );
  });

  it('completes a mixed CSV with only valid rows ingested and public row errors persisted', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/imports/csv')
      .field('mapping', JSON.stringify({ companyName: 'Empresa', email: 'Email', state: 'UF' }))
      .attach(
        'file',
        Buffer.from([
          'Empresa,Email,UF',
          'Válida,contato@valida.test,SP',
          'Email inválido,nao-e-email,SP',
          'UF inválida,contato@uf.test,XX',
        ].join('\n')),
        'mixed-leads.csv',
      )
      .expect(202);

    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: 'lead-1' } });
    await service.process(queue.add.mock.calls[0]?.[1] as ProcessCsvImportJobData);

    expect(response.body).toEqual(expect.objectContaining({ id: IMPORT_ID, totalRows: 3 }));
    expect(ingestion.ingest).toHaveBeenCalledTimes(1);
    expect(prisma.importError.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.importError.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ create: expect.objectContaining({ row: 3, message: 'Invalid email' }) }),
    );
    expect(prisma.importError.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ create: expect.objectContaining({ row: 4, message: 'Invalid Brazilian state' }) }),
    );
    expect(imports.get(IMPORT_ID)).toEqual(expect.objectContaining({
      status: 'COMPLETED',
      importedCount: 1,
      skippedCount: 0,
      invalidCount: 2,
    }));
  });
});
