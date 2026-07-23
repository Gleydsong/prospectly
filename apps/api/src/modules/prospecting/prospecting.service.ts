import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { LeadSource, LeadStatus, Prisma, SearchStatus, WebsitePresence } from '@prisma/client';
import type { Queue } from 'bullmq';

import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LeadIngestionService, type LeadIngestionCandidate } from '../leads/lead-ingestion.service';
import type { NormalizedBusiness } from './domain/normalized-business';
import { OPENSTREETMAP_SEARCH_PROVIDER, type SearchProvider, type SearchProviderInput } from './domain/search-provider';
import { CreateSearchDto } from './dto/create-search.dto';
import { QuerySearchesDto } from './dto/query-searches.dto';
import { PROSPECTING_QUEUE, PROSPECTING_JOB_OPTIONS, RUN_SEARCH_JOB, type RunSearchJobData } from './prospecting.constants';

type SearchInput = SearchProviderInput;

interface SearchResultForImport {
  id: string;
  importedLeadId: string | null;
  normalizedData: Prisma.JsonValue;
}

export interface SearchImportSummary {
  imported: number;
  skipped: number;
  invalid: number;
  conflicts: number;
}

@Injectable()
export class ProspectingService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PROSPECTING_QUEUE) private readonly queue: Queue<RunSearchJobData>,
    @Inject(OPENSTREETMAP_SEARCH_PROVIDER) private readonly provider: SearchProvider,
    private readonly leadIngestion: LeadIngestionService,
  ) {}

  async create(organizationId: string, userId: string, dto: CreateSearchDto, correlationId?: string) {
    const input: SearchInput = {
      category: dto.category.trim(),
      city: dto.city.trim(),
      state: dto.state,
      onlyWithoutWebsite: dto.onlyWithoutWebsite,
    };
    const search = await this.prisma.search.create({
      data: {
        organizationId,
        userId,
        provider: 'OPENSTREETMAP',
        input: input as unknown as Prisma.InputJsonValue,
        status: SearchStatus.PENDING,
        ...(correlationId ? { correlationId } : {}),
      },
    });

    try {
      await this.dispatch(search);
    } catch {
      // The durable PENDING row is intentionally preserved for the reconciler.
    }
    return search;
  }

  async reconcilePending(): Promise<number> {
    const pending = await this.prisma.search.findMany({
      where: { status: SearchStatus.PENDING, jobDispatchedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    let dispatched = 0;
    for (const search of pending) {
      try {
        await this.dispatch(search);
        dispatched += 1;
      } catch {
        // Keep the row pending; the next reconciliation pass retries it.
      }
    }
    return dispatched;
  }

  async list(organizationId: string, query: QuerySearchesDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.SearchWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, searches] = await this.prisma.$transaction([
      this.prisma.search.count({ where }),
      this.prisma.search.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(searches, total, query.page, query.pageSize);
  }

  async get(organizationId: string, id: string) {
    return this.requireSearch(organizationId, id);
  }

  async getJobContext(id: string) {
    return this.prisma.search.findUnique({
      where: { id },
      select: { organizationId: true, correlationId: true },
    });
  }

  async listResults(
    organizationId: string,
    id: string,
    query: QuerySearchesDto,
  ): Promise<PaginatedResult<unknown>> {
    await this.requireSearch(organizationId, id);
    const where = { searchId: id };
    const [total, results] = await this.prisma.$transaction([
      this.prisma.searchResult.count({ where }),
      this.prisma.searchResult.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(results, total, query.page, query.pageSize);
  }

  async process(searchId: string): Promise<void> {
    const search = await this.prisma.search.findUnique({ where: { id: searchId } });
    if (!search) return;

    await this.prisma.search.update({
      where: { id: searchId },
      data: { status: SearchStatus.PROCESSING, error: null, completedAt: null },
    });

    const input = this.readSearchInput(search.input);
    const businesses = await this.provider.search(input);
    const results = input.onlyWithoutWebsite
      ? businesses.filter((business) => business.websitePresence === WebsitePresence.NO_WEBSITE_REPORTED)
      : businesses;

    await this.persistResults(searchId, results);
    await this.prisma.search.update({
      where: { id: searchId },
      data: { status: SearchStatus.COMPLETED, error: null, completedAt: new Date() },
    });
  }

  async recordFailure(searchId: string): Promise<void> {
    await this.prisma.search.update({
      where: { id: searchId },
      data: {
        status: SearchStatus.FAILED,
        error: 'Search provider is temporarily unavailable. Please try again later.',
        completedAt: new Date(),
      },
    });
  }

  async importResults(
    organizationId: string,
    actorId: string,
    searchId: string,
    resultIds: string[],
  ): Promise<SearchImportSummary> {
    const search = await this.requireSearch(organizationId, searchId);
    if (search.status !== SearchStatus.COMPLETED) {
      throw new BadRequestException('Search must be completed before importing results');
    }
    const uniqueResultIds = [...new Set(resultIds)];
    const results = (await this.prisma.searchResult.findMany({
      where: { searchId, id: { in: uniqueResultIds } },
    })) as SearchResultForImport[];
    if (results.length !== uniqueResultIds.length) {
      throw new BadRequestException('One or more results do not belong to this search');
    }

    const summary: SearchImportSummary = { imported: 0, skipped: 0, invalid: 0, conflicts: 0 };
    for (const result of results) {
      if (result.importedLeadId) {
        summary.skipped += 1;
        continue;
      }
      const business = this.readNormalizedBusiness(result.normalizedData);
      if (!business) {
        summary.invalid += 1;
        continue;
      }
      const outcome = await this.leadIngestion.ingest(organizationId, actorId, this.toLeadCandidate(business));
      if (outcome.status === 'IMPORTED') {
        const linked = await this.linkResultIfUnlinked(result.id, outcome.lead.id);
        if (linked) {
          summary.imported += 1;
        } else {
          summary.skipped += 1;
        }
      } else if (outcome.status === 'POSSIBLE_DUPLICATE') {
        summary.conflicts += 1;
      } else {
        if (outcome.lead) {
          await this.linkResultIfUnlinked(result.id, outcome.lead.id);
        }
        summary.skipped += 1;
      }
    }
    return summary;
  }

  private async requireSearch(organizationId: string, id: string) {
    const search = await this.prisma.search.findFirst({ where: { id, organizationId } });
    if (!search) throw new NotFoundException('Search not found');
    return search;
  }

  private async dispatch(search: { id: string; correlationId?: string | null }): Promise<void> {
    await this.queue.add(
      RUN_SEARCH_JOB,
      {
        searchId: search.id,
        ...(search.correlationId ? { correlationId: search.correlationId } : {}),
      },
      { ...PROSPECTING_JOB_OPTIONS, jobId: search.id },
    );
    await this.prisma.search.updateMany({
      where: { id: search.id, status: SearchStatus.PENDING, jobDispatchedAt: null },
      data: { jobDispatchedAt: new Date() },
    });
  }

  private async linkResultIfUnlinked(resultId: string, leadId: string): Promise<boolean> {
    const updated = await this.prisma.searchResult.updateMany({
      where: { id: resultId, importedLeadId: null },
      data: { importedLeadId: leadId },
    });
    return updated.count === 1;
  }

  private async persistResults(searchId: string, businesses: NormalizedBusiness[]): Promise<void> {
    const externalIds = businesses.map((business) => business.externalId);
    await this.prisma.$transaction(async (transaction) => {
      for (const business of businesses) {
        const data = {
          data: business as unknown as Prisma.InputJsonValue,
          normalizedData: business as unknown as Prisma.InputJsonValue,
          websitePresence: business.websitePresence,
        };
        await transaction.searchResult.upsert({
          where: { searchId_externalId: { searchId, externalId: business.externalId } },
          create: { searchId, externalId: business.externalId, ...data },
          update: data,
        });
      }
      await transaction.searchResult.deleteMany({
        where: {
          searchId,
          ...(externalIds.length ? { externalId: { notIn: externalIds } } : {}),
        },
      });
    });
  }

  private readSearchInput(value: Prisma.JsonValue): SearchInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid persisted search input');
    }
    const input = value as Record<string, unknown>;
    if (
      typeof input.category !== 'string' ||
      typeof input.city !== 'string' ||
      typeof input.state !== 'string' ||
      typeof input.onlyWithoutWebsite !== 'boolean'
    ) {
      throw new BadRequestException('Invalid persisted search input');
    }
    return input as unknown as SearchInput;
  }

  private readNormalizedBusiness(value: Prisma.JsonValue): NormalizedBusiness | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const business = value as Record<string, unknown>;
    if (
      typeof business.externalId !== 'string' ||
      typeof business.companyName !== 'string' ||
      typeof business.city !== 'string' ||
      typeof business.state !== 'string' ||
      typeof business.websitePresence !== 'string'
    ) {
      return null;
    }
    return business as unknown as NormalizedBusiness;
  }

  private toLeadCandidate(business: NormalizedBusiness): LeadIngestionCandidate {
    return {
      companyName: business.companyName,
      category: business.category,
      phone: business.phone,
      email: business.email,
      website: business.website,
      address: business.address,
      city: business.city,
      state: business.state,
      country: business.country,
      postalCode: business.postalCode,
      latitude: business.latitude,
      longitude: business.longitude,
      source: LeadSource.OPENSTREETMAP,
      externalId: business.externalId,
      status: LeadStatus.TO_REVIEW,
      websitePresence: business.websitePresence,
      websiteCheckedAt: new Date(),
      websiteCheckSource: 'OpenStreetMap',
      notes: 'Importado do OpenStreetMap. Validação manual de website necessária.',
      tags: ['sem-site'],
    };
  }
}
