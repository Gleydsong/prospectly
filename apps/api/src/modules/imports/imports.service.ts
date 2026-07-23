import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImportStatus, LeadSource, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';

import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadIngestionService, type LeadIngestionCandidate } from '../leads/lead-ingestion.service';
import { BRAZILIAN_STATE_CODES } from '../prospecting/domain/search-provider';
import { CsvParserService, type CsvRow } from './csv-parser.service';
import {
  IMPORT_JOB_OPTIONS,
  IMPORT_MAPPING_FIELDS,
  IMPORTS_QUEUE,
  PROCESS_CSV_IMPORT_JOB,
  type ProcessCsvImportJobData,
} from './imports.constants';

type ImportMapping = Record<string, string>;

const IMPORT_PUBLIC_SELECT = {
  id: true,
  fileName: true,
  status: true,
  totalRows: true,
  importedCount: true,
  skippedCount: true,
  invalidCount: true,
  mapping: true,
  createdAt: true,
  completedAt: true,
} as const satisfies Prisma.ImportSelect;

type PublicImport = Prisma.ImportGetPayload<{ select: typeof IMPORT_PUBLIC_SELECT }>;
const IMPORT_PUBLIC_KEYS = Object.keys(IMPORT_PUBLIC_SELECT) as Array<keyof PublicImport>;

function serializePublicImport(record: PublicImport): PublicImport {
  const serialized: Partial<PublicImport> = {};
  for (const key of IMPORT_PUBLIC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      Object.assign(serialized, { [key]: record[key] });
    }
  }
  return serialized as PublicImport;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(IMPORTS_QUEUE) private readonly queue: Queue<ProcessCsvImportJobData>,
    private readonly leadIngestion: LeadIngestionService,
    private readonly csvParser: CsvParserService,
    private readonly config: ConfigService,
  ) {}

  preview(fileName: string, content: Buffer) {
    this.assertCsvFile(fileName);
    return this.csvParser.preview(content.toString('utf8'), this.maxRows);
  }

  async createFromFile(
    organizationId: string,
    userId: string,
    fileName: string,
    content: Buffer,
    mapping: ImportMapping,
    correlationId?: string,
  ) {
    this.assertCsvFile(fileName);
    const parsed = this.csvParser.parse(content.toString('utf8'), this.maxRows);
    this.validateMapping(mapping);
    for (const column of Object.values(mapping)) {
      if (!parsed.headers.includes(column)) {
        throw new BadRequestException('CSV mapping references an unknown header');
      }
    }
    return this.create(organizationId, userId, fileName, mapping, parsed.rows, correlationId);
  }

  async create(
    organizationId: string,
    userId: string,
    fileName: string,
    mapping: ImportMapping,
    rows: CsvRow[],
    correlationId?: string,
  ) {
    this.validateMapping(mapping);
    const importRecord = await this.prisma.import.create({
      data: {
        organizationId,
        userId,
        fileName,
        status: ImportStatus.PENDING,
        totalRows: rows.length,
        mapping: mapping as Prisma.InputJsonValue,
        stagedRows: rows as Prisma.InputJsonValue,
        ...(correlationId ? { correlationId } : {}),
      },
      select: IMPORT_PUBLIC_SELECT,
    });

    try {
      await this.dispatch({ id: importRecord.id, correlationId });
    } catch {
      // The staged PENDING record is durable and will be retried by reconciliation.
    }

    return serializePublicImport(importRecord);
  }

  async reconcilePending(): Promise<number> {
    const pending = await this.prisma.import.findMany({
      where: {
        status: ImportStatus.PENDING,
        jobDispatchedAt: null,
        stagedRows: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    let dispatched = 0;
    for (const importRecord of pending) {
      try {
        await this.dispatch(importRecord);
        dispatched += 1;
      } catch {
        // Keep the row pending; the next reconciliation pass retries it.
      }
    }
    return dispatched;
  }

  async list(
    organizationId: string,
    query: { page: number; pageSize: number },
  ): Promise<PaginatedResult<unknown>> {
    const where = { organizationId };
    const [total, imports] = await this.prisma.$transaction([
      this.prisma.import.count({ where }),
      this.prisma.import.findMany({
        where,
        select: IMPORT_PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(imports.map(serializePublicImport), total, query.page, query.pageSize);
  }

  async get(organizationId: string, id: string) {
    return serializePublicImport(await this.requireImport(organizationId, id));
  }

  async getJobContext(id: string) {
    return this.prisma.import.findUnique({
      where: { id },
      select: { organizationId: true, correlationId: true },
    });
  }

  async listErrors(
    organizationId: string,
    importId: string,
    query: { page: number; pageSize: number },
  ): Promise<PaginatedResult<unknown>> {
    await this.requireImport(organizationId, importId);
    const where = { importId };
    const [total, errors] = await this.prisma.$transaction([
      this.prisma.importError.count({ where }),
      this.prisma.importError.findMany({
        where,
        orderBy: { row: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(errors, total, query.page, query.pageSize);
  }

  async process(job: ProcessCsvImportJobData): Promise<void> {
    const importRecord = await this.prisma.import.findUnique({ where: { id: job.importId } });
    if (!importRecord) return;
    if (importRecord.status === ImportStatus.COMPLETED || importRecord.status === ImportStatus.FAILED) {
      return;
    }

    const mapping = this.readPersistedMapping(importRecord.mapping);
    const rows = this.readPersistedRows(importRecord.stagedRows);
    this.validateMapping(mapping);
    await this.prisma.import.update({
      where: { id: job.importId },
      data: { status: ImportStatus.PROCESSING, completedAt: null },
    });

    let importedCount = 0;
    let skippedCount = 0;
    let invalidCount = 0;

    for (const [index, row] of rows.entries()) {
      try {
        const candidate = this.toLeadCandidate(job.importId, index + 2, mapping, row);
        const result = await this.leadIngestion.ingest(
          importRecord.organizationId,
          importRecord.userId,
          candidate,
        );
        if (
          result.status === 'IMPORTED' ||
          (result.status === 'DUPLICATE' &&
            (await this.wasImportedByThisRow(importRecord.organizationId, candidate.externalId!)))
        ) {
          importedCount += 1;
        } else {
          skippedCount += 1;
        }
      } catch (error) {
        if (!(error instanceof BadRequestException)) {
          throw error;
        }
        invalidCount += 1;
        const message = this.toSafeRowError(error);
        await this.prisma.importError.upsert({
          where: { importId_row: { importId: job.importId, row: index + 2 } },
          create: {
            importId: job.importId,
            row: index + 2,
            message,
            data: row as Prisma.InputJsonValue,
          },
          update: { message, data: row as Prisma.InputJsonValue },
        });
      }
    }

    await this.prisma.import.update({
      where: { id: job.importId },
      data: {
        status: ImportStatus.COMPLETED,
        importedCount,
        skippedCount,
        invalidCount,
        completedAt: new Date(),
        stagedRows: Prisma.DbNull,
      },
    });
  }

  async recordFailure(importId: string): Promise<void> {
    await this.prisma.import.update({
      where: { id: importId },
      data: { status: ImportStatus.FAILED, completedAt: new Date(), stagedRows: Prisma.DbNull },
    });
  }

  private async requireImport(organizationId: string, id: string) {
    const importRecord = await this.prisma.import.findFirst({
      where: { id, organizationId },
      select: IMPORT_PUBLIC_SELECT,
    });
    if (!importRecord) throw new NotFoundException('Import not found');
    return importRecord;
  }

  private async dispatch(importRecord: { id: string; correlationId?: string | null }): Promise<void> {
    await this.queue.add(
      PROCESS_CSV_IMPORT_JOB,
      {
        importId: importRecord.id,
        ...(importRecord.correlationId ? { correlationId: importRecord.correlationId } : {}),
      },
      { ...IMPORT_JOB_OPTIONS, jobId: importRecord.id },
    );
    await this.prisma.import.updateMany({
      where: { id: importRecord.id, status: ImportStatus.PENDING, jobDispatchedAt: null },
      data: { jobDispatchedAt: new Date() },
    });
  }

  private readPersistedMapping(value: Prisma.JsonValue | null): ImportMapping {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid persisted CSV mapping');
    }
    return value as ImportMapping;
  }

  private readPersistedRows(value: Prisma.JsonValue | null): CsvRow[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('Invalid persisted CSV rows');
    }
    const valid = value.every(
      (row) =>
        row !== null &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        Object.values(row).every((cell) => typeof cell === 'string'),
    );
    if (!valid) {
      throw new BadRequestException('Invalid persisted CSV rows');
    }
    return value as CsvRow[];
  }

  private validateMapping(mapping: Record<string, unknown>): void {
    if (typeof mapping.companyName !== 'string' || !mapping.companyName.trim()) {
      throw new BadRequestException('companyName mapping is required');
    }
    for (const [field, column] of Object.entries(mapping)) {
      if (
        !IMPORT_MAPPING_FIELDS.includes(field as (typeof IMPORT_MAPPING_FIELDS)[number]) ||
        typeof column !== 'string' ||
        !column.trim()
      ) {
        throw new BadRequestException('Invalid CSV mapping');
      }
    }
  }

  private assertCsvFile(fileName: string): void {
    if (!fileName.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException('Only CSV files are supported');
    }
  }

  private get maxRows(): number {
    return this.config.get<number>('csv.maxRows') ?? 10_000;
  }

  private toLeadCandidate(
    importId: string,
    rowNumber: number,
    mapping: ImportMapping,
    row: CsvRow,
  ): LeadIngestionCandidate {
    const value = (field: string): string | undefined => {
      const column = mapping[field];
      const raw = column ? row[column]?.trim() : undefined;
      return raw || undefined;
    };
    const companyName = value('companyName');
    if (!companyName) throw new BadRequestException('Company name is required');

    const candidate: LeadIngestionCandidate = {
      companyName,
      phone: value('phone'),
      email: value('email'),
      website: value('website'),
      category: value('category'),
      address: value('address'),
      city: value('city'),
      state: value('state'),
      postalCode: value('postalCode'),
      notes: value('notes'),
      source: LeadSource.CSV_IMPORT,
      externalId: 'csv-import:' + importId + ':' + rowNumber,
      tags: value('tags')
        ?.split(/[;,|]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    this.validateCandidate(candidate);
    return candidate;
  }

  private validateCandidate(candidate: LeadIngestionCandidate): void {
    this.assertLength(candidate.companyName, 200, 'Company name is too long');
    this.assertLength(candidate.category, 120, 'Category is too long');
    this.assertLength(candidate.address, 300, 'Address is too long');
    this.assertLength(candidate.city, 120, 'City is too long');
    this.assertLength(candidate.notes, 5_000, 'Notes are too long');

    if (candidate.email) {
      this.assertLength(candidate.email, 160, 'Email is too long');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email)) {
        throw new BadRequestException('Invalid email');
      }
    }

    if (candidate.website) {
      this.assertLength(candidate.website, 500, 'Website is too long');
      try {
        const url = new URL(candidate.website);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
          throw new Error('unsupported URL');
        }
      } catch {
        throw new BadRequestException('Invalid website URL');
      }
    }

    if (candidate.state) {
      candidate.state = candidate.state.toUpperCase();
      if (!(BRAZILIAN_STATE_CODES as readonly string[]).includes(candidate.state)) {
        throw new BadRequestException('Invalid Brazilian state');
      }
    }

    if (candidate.phone) {
      this.assertLength(candidate.phone, 32, 'Phone is too long');
      const digits = candidate.phone.replace(/\D/g, '');
      const national = digits.length === 10 || digits.length === 11;
      const international = digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
      if (!national && !international) {
        throw new BadRequestException('Invalid Brazilian phone');
      }
    }

    if (candidate.postalCode) {
      this.assertLength(candidate.postalCode, 20, 'Postal code is too long');
      if (!/^\d{5}-?\d{3}$/.test(candidate.postalCode)) {
        throw new BadRequestException('Invalid Brazilian postal code');
      }
    }
  }

  private assertLength(value: string | undefined, maximum: number, message: string): void {
    if (value && value.length > maximum) {
      throw new BadRequestException(message);
    }
  }

  private async wasImportedByThisRow(organizationId: string, externalId: string): Promise<boolean> {
    const lead = await this.prisma.lead.findFirst({
      where: { organizationId, source: LeadSource.CSV_IMPORT, externalId },
      select: { id: true },
    });
    return Boolean(lead);
  }

  private toSafeRowError(error: unknown): string {
    const publicMessages = new Set([
      'Company name is required',
      'Company name is too long',
      'Category is too long',
      'Address is too long',
      'City is too long',
      'Notes are too long',
      'Email is too long',
      'Invalid email',
      'Website is too long',
      'Invalid website URL',
      'Invalid Brazilian state',
      'Phone is too long',
      'Invalid Brazilian phone',
      'Postal code is too long',
      'Invalid Brazilian postal code',
    ]);
    if (error instanceof BadRequestException && publicMessages.has(error.message)) {
      return error.message;
    }
    return 'Unable to import row';
  }
}
