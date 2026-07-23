import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ImportsService } from './imports.service';

const mapping = {
  companyName: 'Empresa',
  phone: 'Telefone',
  email: 'Email',
  tags: 'Tags',
};

const rows = [
  {
    Empresa: 'Acme Ltda',
    Telefone: '11999999999',
    Email: 'contato@acme.test',
    Tags: 'novo; prioridade',
  },
  { Empresa: '', Telefone: '11888888888', Email: 'invalido@acme.test', Tags: 'novo' },
  { Empresa: 'Duplicada', Telefone: '11777777777', Email: 'duplicada@acme.test', Tags: '' },
];

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    import: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    importError: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    lead: { findFirst: jest.fn() },
    $transaction: jest.fn(),
    ...overrides,
  };
  prisma.$transaction.mockImplementation((work: unknown) =>
    Promise.all(work as Promise<unknown>[]),
  );
  const queue = { add: jest.fn() };
  const ingestion = { ingest: jest.fn() };
  const parser = { preview: jest.fn(), parse: jest.fn() };
  const config = { get: jest.fn().mockReturnValue(10_000) };

  return {
    prisma,
    queue,
    ingestion,
    parser,
    config,
    service: new ImportsService(
      prisma as never,
      queue as never,
      ingestion as never,
      parser as never,
      config as never,
    ),
  };
}

describe('ImportsService', () => {
  it('previews only CSV files without creating an import', () => {
    const { parser, service } = createService();
    parser.preview.mockReturnValue({
      headers: ['Empresa'],
      rows: [{ Empresa: 'Acme Ltda' }],
      suggestedMapping: {},
    });

    expect(service.preview('leads.csv', Buffer.from('Empresa\nAcme Ltda'))).toEqual({
      headers: ['Empresa'],
      rows: [{ Empresa: 'Acme Ltda' }],
      suggestedMapping: {},
    });
    expect(parser.preview).toHaveBeenCalledWith('Empresa\nAcme Ltda', 10_000);
    expect(() => service.preview('leads.xlsx', Buffer.from('binary'))).toThrow(BadRequestException);
  });

  it('parses a CSV upload before scheduling its import', async () => {
    const { parser, prisma, queue, service } = createService();
    parser.parse.mockReturnValue({ headers: ['Empresa'], rows: [{ Empresa: 'Acme Ltda' }] });
    prisma.import.create.mockResolvedValue({ id: 'import-1' });
    queue.add.mockResolvedValue(undefined);

    await service.createFromFile(
      'org-1',
      'user-1',
      'leads.csv',
      Buffer.from('Empresa\nAcme Ltda'),
      { companyName: 'Empresa' },
    );

    expect(parser.parse).toHaveBeenCalledWith('Empresa\nAcme Ltda', 10_000);
    expect(queue.add).toHaveBeenCalledWith(
      'process-csv-import',
      { importId: 'import-1' },
      expect.any(Object),
    );
  });

  it('creates a tenant-scoped pending import and queues safe staged rows', async () => {
    const { prisma, queue, service } = createService();
    const created = { id: 'import-1', status: 'PENDING', correlationId: 'corr-1' };
    prisma.import.create.mockResolvedValue(created);
    queue.add.mockResolvedValue(undefined);

    await expect(
      service.create('org-1', 'user-1', 'leads.csv', mapping, rows, 'corr-1'),
    ).resolves.toEqual({ id: 'import-1', status: 'PENDING' });

    expect(prisma.import.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        fileName: 'leads.csv',
        status: 'PENDING',
        totalRows: 3,
        mapping,
        stagedRows: rows,
        correlationId: 'corr-1',
      },
      select: expect.objectContaining({ id: true, fileName: true, status: true }),
    });
    expect(queue.add).toHaveBeenCalledWith(
      'process-csv-import',
      { importId: 'import-1', correlationId: 'corr-1' },
      expect.objectContaining({ jobId: 'import-1', attempts: 3 }),
    );
  });

  it('rejects mappings that omit companyName or contain unsupported fields', async () => {
    const { service } = createService();

    await expect(
      service.create('org-1', 'user-1', 'leads.csv', { email: 'Email' }, rows),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        'org-1',
        'user-1',
        'leads.csv',
        { companyName: 'Empresa', unknown: 'x' },
        rows,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('org-1', 'user-1', 'leads.csv', { companyName: 1 } as never, rows),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('org-1', 'user-1', 'leads.csv', { companyName: {} } as never, rows),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('org-1', 'user-1', 'leads.csv', { companyName: [] } as never, rows),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps staged CSV rows recoverable when dispatch fails and reconciles later', async () => {
    const { prisma, queue, service } = createService();
    const importRecord = { id: 'import-1', status: 'PENDING', correlationId: 'corr-1' };
    prisma.import.create.mockResolvedValue(importRecord);
    queue.add.mockRejectedValue(new Error('redis password=super-secret unavailable'));

    await expect(
      service.create('org-1', 'user-1', 'leads.csv', mapping, rows, 'corr-1'),
    ).resolves.toEqual({ id: 'import-1', status: 'PENDING' });

    prisma.import.findMany.mockResolvedValue([importRecord]);
    prisma.import.updateMany.mockResolvedValue({ count: 1 });
    queue.add.mockResolvedValue(undefined);
    await service.reconcilePending();

    expect(queue.add).toHaveBeenLastCalledWith(
      'process-csv-import',
      { importId: 'import-1', correlationId: 'corr-1' },
      expect.objectContaining({ jobId: 'import-1' }),
    );
    expect(prisma.import.updateMany).toHaveBeenCalledWith({
      where: { id: 'import-1', status: 'PENDING', jobDispatchedAt: null },
      data: { jobDispatchedAt: expect.any(Date) },
    });
  });

  it('scopes import history and hides imports from another organization', async () => {
    const { prisma, service } = createService();
    prisma.$transaction.mockResolvedValue([1, [{
      id: 'import-1',
      fileName: 'leads.csv',
      status: 'PENDING',
      totalRows: 1,
      importedCount: 0,
      skippedCount: 0,
      invalidCount: 0,
      mapping: { companyName: 'Empresa' },
      createdAt: new Date('2026-07-22T10:00:00.000Z'),
      completedAt: null,
      organizationId: 'org-1',
      userId: 'user-1',
      correlationId: 'corr-secret',
      jobDispatchedAt: new Date(),
      stagedRows: rows,
    }]]);
    prisma.import.findFirst
      .mockResolvedValueOnce({
        id: 'import-1',
        fileName: 'leads.csv',
        status: 'PENDING',
        totalRows: 1,
        importedCount: 0,
        skippedCount: 0,
        invalidCount: 0,
        mapping: { companyName: 'Empresa' },
        createdAt: new Date('2026-07-22T10:00:00.000Z'),
        completedAt: null,
        organizationId: 'org-1',
        userId: 'user-1',
        correlationId: 'corr-secret',
        jobDispatchedAt: new Date(),
        stagedRows: rows,
      })
      .mockResolvedValueOnce(null);

    const history = await service.list('org-1', { page: 1, pageSize: 20 });
    const detail = await service.get('org-1', 'import-1');

    expect(history).toEqual({
      data: [expect.objectContaining({ id: 'import-1', fileName: 'leads.csv' })],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    for (const record of [history.data[0], detail]) {
      expect(record).not.toHaveProperty('stagedRows');
      expect(record).not.toHaveProperty('organizationId');
      expect(record).not.toHaveProperty('userId');
      expect(record).not.toHaveProperty('correlationId');
      expect(record).not.toHaveProperty('jobDispatchedAt');
    }
    await expect(service.get('org-1', 'import-2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.import.findFirst).toHaveBeenCalledWith({
      where: { id: 'import-2', organizationId: 'org-1' },
      select: expect.any(Object),
    });
  });

  it('imports valid rows, persists row errors and counts duplicates as skipped', async () => {
    const { prisma, ingestion, service } = createService();
    prisma.import.findUnique.mockResolvedValue({
      id: 'import-1',
      organizationId: 'org-1',
      userId: 'user-1',
      mapping,
      stagedRows: rows,
    });
    prisma.import.update.mockResolvedValue(undefined);
    ingestion.ingest
      .mockResolvedValueOnce({ status: 'IMPORTED', lead: { id: 'lead-1' } })
      .mockResolvedValueOnce({ status: 'DUPLICATE', lead: { id: 'lead-2' } });

    await service.process({ importId: 'import-1' });

    expect(ingestion.ingest).toHaveBeenNthCalledWith(
      1,
      'org-1',
      'user-1',
      expect.objectContaining({
        companyName: 'Acme Ltda',
        phone: '11999999999',
        email: 'contato@acme.test',
        tags: ['novo', 'prioridade'],
        source: 'CSV_IMPORT',
        externalId: 'csv-import:import-1:2',
      }),
    );
    expect(prisma.importError.upsert).toHaveBeenCalledWith({
      where: { importId_row: { importId: 'import-1', row: 3 } },
      create: {
        importId: 'import-1',
        row: 3,
        message: 'Company name is required',
        data: rows[1],
      },
      update: { message: 'Company name is required', data: rows[1] },
    });
    expect(prisma.import.update).toHaveBeenLastCalledWith({
      where: { id: 'import-1' },
      data: {
        status: 'COMPLETED',
        importedCount: 1,
        skippedCount: 1,
        invalidCount: 1,
        completedAt: expect.any(Date),
        stagedRows: Prisma.DbNull,
      },
    });
  });

  it('rejects invalid email, website, UF, Brazilian phone and CEP per row without ingesting them', async () => {
    const validationMapping = {
      companyName: 'Empresa',
      email: 'Email',
      website: 'Website',
      state: 'UF',
      phone: 'Telefone',
      postalCode: 'CEP',
    };
    const validationRows = [
      {
        Empresa: 'Válida',
        Email: 'contato@valida.test',
        Website: 'https://valida.test',
        UF: 'SP',
        Telefone: '11999999999',
        CEP: '01000-000',
      },
      { Empresa: 'Email ruim', Email: 'invalido', Website: '', UF: 'SP', Telefone: '', CEP: '' },
      { Empresa: 'Site ruim', Email: '', Website: 'javascript:alert(1)', UF: 'SP', Telefone: '', CEP: '' },
      { Empresa: 'UF ruim', Email: '', Website: '', UF: 'XX', Telefone: '', CEP: '' },
      { Empresa: 'Telefone ruim', Email: '', Website: '', UF: 'SP', Telefone: '123', CEP: '' },
      { Empresa: 'CEP ruim', Email: '', Website: '', UF: 'SP', Telefone: '', CEP: '123' },
    ];
    const { prisma, ingestion, service } = createService();
    prisma.import.findUnique.mockResolvedValue({
      id: 'import-1',
      organizationId: 'org-1',
      userId: 'user-1',
      mapping: validationMapping,
      stagedRows: validationRows,
    });
    ingestion.ingest.mockResolvedValue({ status: 'IMPORTED', lead: { id: 'lead-1' } });

    await service.process({ importId: 'import-1' });

    expect(ingestion.ingest).toHaveBeenCalledTimes(1);
    expect(prisma.importError.upsert).toHaveBeenCalledTimes(5);
    expect(prisma.importError.upsert.mock.calls.map((call) => call[0].create.message)).toEqual([
      'Invalid email',
      'Invalid website URL',
      'Invalid Brazilian state',
      'Invalid Brazilian phone',
      'Invalid Brazilian postal code',
    ]);
    expect(prisma.import.update).toHaveBeenLastCalledWith({
      where: { id: 'import-1' },
      data: {
        status: 'COMPLETED',
        importedCount: 1,
        skippedCount: 0,
        invalidCount: 5,
        completedAt: expect.any(Date),
        stagedRows: Prisma.DbNull,
      },
    });
  });

  it('rethrows transient ingestion failures and recomputes retry counters from durable row identities', async () => {
    const retryRows = [
      { Empresa: 'Acme Ltda', Telefone: '11999999999', Email: 'acme@test.dev', Tags: '' },
      { Empresa: 'Beta Ltda', Telefone: '11888888888', Email: 'beta@test.dev', Tags: '' },
    ];
    const { prisma, ingestion, service } = createService();
    prisma.import.findUnique.mockResolvedValue({
      id: 'import-1',
      organizationId: 'org-1',
      userId: 'user-1',
      mapping,
      stagedRows: retryRows,
    });
    prisma.import.update.mockResolvedValue(undefined);
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-acme' });
    ingestion.ingest
      .mockResolvedValueOnce({ status: 'IMPORTED', lead: { id: 'lead-acme' } })
      .mockRejectedValueOnce(new Error('database temporarily unavailable'))
      .mockResolvedValueOnce({ status: 'DUPLICATE', lead: { id: 'lead-acme' } })
      .mockResolvedValueOnce({ status: 'IMPORTED', lead: { id: 'lead-beta' } });
    const job = { importId: 'import-1' };

    await expect(service.process(job)).rejects.toThrow('database temporarily unavailable');
    expect(prisma.import.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ stagedRows: Prisma.DbNull }),
    }));
    await expect(service.process(job)).resolves.toBeUndefined();

    expect(prisma.lead.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', source: 'CSV_IMPORT', externalId: 'csv-import:import-1:2' },
      select: { id: true },
    });
    expect(prisma.import.update).toHaveBeenLastCalledWith({
      where: { id: 'import-1' },
      data: {
        status: 'COMPLETED',
        importedCount: 2,
        skippedCount: 0,
        invalidCount: 0,
        completedAt: expect.any(Date),
        stagedRows: Prisma.DbNull,
      },
    });
  });

  it('records a safe failed status after the final worker failure', async () => {
    const { prisma, service } = createService();

    await service.recordFailure('import-1');

    expect(prisma.import.update).toHaveBeenCalledWith({
      where: { id: 'import-1' },
      data: { status: 'FAILED', completedAt: expect.any(Date), stagedRows: Prisma.DbNull },
    });
  });

  it('lists paginated row errors only for the owning organization', async () => {
    const { prisma, service } = createService();
    prisma.import.findFirst.mockResolvedValue({ id: 'import-1' });
    prisma.$transaction.mockResolvedValue([1, [{ row: 3, message: 'Company name is required' }]]);

    await expect(
      service.listErrors('org-1', 'import-1', { page: 1, pageSize: 20 }),
    ).resolves.toEqual({
      data: [{ row: 3, message: 'Company name is required' }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(prisma.importError.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { importId: 'import-1' }, orderBy: { row: 'asc' } }),
    );
  });
});
