import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfidenceLevel, LeadSource, LeadStatus, OrgPlan, Prisma, SearchStatus, WebsitePresence } from '@prisma/client';
import type { Queue } from 'bullmq';
import {
  DEFAULT_SEARCH_RESULT_LIMIT,
  MAX_SEARCH_RESULT_LIMIT,
  SEARCH_RESULT_LIMITS,
  type ProspectingCategoryCatalog,
} from '@prospectly/shared-types';

import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  isDuplicateJobError,
  SEARCH_JOB_STALE_MS,
  staleBefore,
} from '../../common/workers/durable-job';
import { BillingService } from '../billing/billing.service';
import { LeadIngestionService, type LeadIngestionCandidate } from '../leads/lead-ingestion.service';
import { MetricsService } from '../ops/metrics.service';
import {
  CATEGORY_REQUIRED_PLAN,
  availableCategoryCount,
  effectivePlan,
  isCategoryAvailable,
  listCategoryOptions,
} from './domain/category-entitlements';
import type { NormalizedBusiness } from './domain/normalized-business';
import { mergeProviderResults } from './domain/merge-search-results';
import {
  COMBINED_SEARCH_PROVIDER,
  isProspectingCountryCode,
  isStoredSearchProvider,
  SEARCH_PROVIDER_REGISTRY,
  type SearchProviderInput,
  type SearchProviderRegistry,
} from './domain/search-provider';
import { CreateSearchDto } from './dto/create-search.dto';
import { QuerySearchesDto } from './dto/query-searches.dto';
import { PROSPECTING_QUEUE, PROSPECTING_JOB_OPTIONS, RUN_SEARCH_JOB, type RunSearchJobData } from './prospecting.constants';

type SearchInput = SearchProviderInput;

interface SearchResultForImport {
  id: string;
  importedLeadId: string | null;
  normalizedData: Prisma.JsonValue;
}

export type SearchImportItemStatus = 'IMPORTED' | 'SKIPPED' | 'INVALID' | 'CONFLICT';

export interface SearchImportItemResult {
  resultId: string;
  status: SearchImportItemStatus;
  leadId?: string;
  companyName?: string;
}

export interface SearchImportSummary {
  imported: number;
  skipped: number;
  invalid: number;
  conflicts: number;
  items: SearchImportItemResult[];
}

@Injectable()
export class ProspectingService {
  private readonly logger = new Logger(ProspectingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PROSPECTING_QUEUE) private readonly queue: Queue<RunSearchJobData>,
    @Inject(SEARCH_PROVIDER_REGISTRY) private readonly providers: SearchProviderRegistry,
    private readonly leadIngestion: LeadIngestionService,
    private readonly billing: BillingService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  listProviders() {
    return this.providers.list().filter((provider) => provider.available);
  }

  async listCategories(organizationId: string): Promise<ProspectingCategoryCatalog> {
    const plan = await this.resolvePlan(organizationId);
    const categories = listCategoryOptions(plan);
    return {
      categories,
      total: categories.length,
      availableCount: availableCategoryCount(plan),
      plan,
      requiredPlan: CATEGORY_REQUIRED_PLAN,
    };
  }

  async create(organizationId: string, userId: string, dto: CreateSearchDto, correlationId?: string) {
    await this.billing.assertCanCreateSearch(organizationId);

    const availableProviders = this.providers.list().filter((provider) => provider.available);
    if (availableProviders.length === 0) {
      throw new BadRequestException('No search providers available');
    }

    // Always fan-out to every available map source for denser, merged results.
    // Legacy single-provider values remain accepted on the DTO but are ignored.
    const providerId =
      availableProviders.length > 1
        ? COMBINED_SEARCH_PROVIDER
        : availableProviders[0]!.id;

    const categories = [...new Set(dto.categories.map((category) => category.trim()))];
    await this.assertCategoriesAllowed(organizationId, categories);

    const neighborhood = dto.neighborhood?.trim();
    const input: SearchInput = {
      categories,
      category: categories[0]!,
      city: dto.city.trim(),
      ...(neighborhood ? { neighborhood } : {}),
      state: dto.state,
      country: dto.country,
      onlyWithoutWebsite: dto.onlyWithoutWebsite,
      limit: DEFAULT_SEARCH_RESULT_LIMIT,
    };
    const search = await this.prisma.search.create({
      data: {
        organizationId,
        userId,
        provider: providerId,
        input: input as unknown as Prisma.InputJsonValue,
        status: SearchStatus.PENDING,
        ...(correlationId ? { correlationId } : {}),
      },
    });

    if (typeof this.billing.consumeCreditForSearch === 'function') {
      try {
        await this.billing.consumeCreditForSearch(organizationId, search.id);
      } catch (error) {
        await this.prisma.search.delete({ where: { id: search.id } }).catch(() => undefined);
        throw error;
      }
    }

    try {
      await this.dispatch(search);
    } catch {
      // The durable PENDING row is intentionally preserved for the reconciler.
    }
    return search;
  }

  async reconcilePending(): Promise<number> {
    const stale = staleBefore(SEARCH_JOB_STALE_MS);
    const pending = await this.prisma.search.findMany({
      where: {
        OR: [
          { status: SearchStatus.PENDING, jobDispatchedAt: null },
          { status: SearchStatus.PENDING, jobDispatchedAt: { lt: stale } },
          { status: SearchStatus.PROCESSING, jobDispatchedAt: { lt: stale } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    let dispatched = 0;
    for (const search of pending) {
      try {
        const recovered = search.jobDispatchedAt !== null;
        await this.dispatch(search);
        if (recovered) {
          this.metrics?.recordJobRecovered();
          this.logger.log({
            event: 'critical_job_recovered',
            jobId: search.id,
            type: 'search',
            status: search.status,
          });
        }
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
    const [total, searches] = await Promise.all([
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

  async remove(organizationId: string, id: string): Promise<void> {
    await this.requireSearch(organizationId, id);
    await this.prisma.search.delete({ where: { id } });
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
    const [total, results] = await Promise.all([
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
    // BullMQ can retry after a successful run if the ack is lost. Never re-enter
    // a completed search — a later empty provider response would wipe results.
    if (search.status === SearchStatus.COMPLETED) return;

    await this.prisma.search.update({
      where: { id: searchId },
      data: { status: SearchStatus.PROCESSING, error: null, completedAt: null },
    });

    if (!isStoredSearchProvider(search.provider)) {
      throw new BadRequestException('Invalid persisted search provider');
    }

    const input = this.readSearchInput(search.input);
    const categories = this.resolveCategories(input);
    const providerIds = this.providers
      .list()
      .filter((entry) => entry.available)
      .map((entry) => entry.id);

    if (providerIds.length === 0) {
      throw new BadRequestException('No search providers available');
    }

    const startedAt = Date.now();
    const settled = await Promise.allSettled(
      providerIds.map(async (providerId) => {
        const providerStartedAt = Date.now();
        try {
          const businesses = await this.providers.resolve(providerId).search({
            ...input,
            category: categories[0]!,
            categories,
          });
          this.logger.log({
            message: 'Search provider completed',
            searchId,
            providerId,
            resultCount: businesses.length,
            durationMs: Date.now() - providerStartedAt,
          });
          return businesses;
        } catch (error) {
          this.logger.warn({
            message: 'Search provider failed',
            searchId,
            providerId,
            durationMs: Date.now() - providerStartedAt,
            reason: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      }),
    );
    this.logger.log({
      message: 'Combined search providers settled',
      searchId,
      providerIds,
      durationMs: Date.now() - startedAt,
      fulfilled: settled.filter((result) => result.status === 'fulfilled').length,
      rejected: settled.filter((result) => result.status === 'rejected').length,
    });

    const batches = settled.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (batches.length === 0) {
      const firstFailure = settled.find((result) => result.status === 'rejected');
      throw firstFailure && firstFailure.status === 'rejected'
        ? firstFailure.reason
        : new Error('Search provider is temporarily unavailable. Please try again later.');
    }

    const merged = mergeProviderResults(
      batches.flatMap((businesses) =>
        businesses.map((business) => ({
          ...business,
          category: business.category ?? categories[0],
        })),
      ),
    );

    const filtered = input.onlyWithoutWebsite
      ? merged.filter((business) => business.websitePresence === WebsitePresence.NO_WEBSITE_REPORTED)
      : merged;
    const capped = filtered.slice(0, input.limit ?? DEFAULT_SEARCH_RESULT_LIMIT);

    await this.persistResults(searchId, capped);
    await this.prisma.search.update({
      where: { id: searchId },
      data: { status: SearchStatus.COMPLETED, error: null, completedAt: new Date() },
    });
  }

  async recordFailure(searchId: string, errorMessage?: string): Promise<void> {
    const search = await this.prisma.search.findUnique({
      where: { id: searchId },
      select: { organizationId: true, status: true },
    });
    await this.prisma.search.update({
      where: { id: searchId },
      data: {
        status: SearchStatus.FAILED,
        error:
          errorMessage ??
          'Search provider is temporarily unavailable. Please try again later.',
        completedAt: new Date(),
      },
    });
    if (search && search.status !== SearchStatus.COMPLETED) {
      await this.billing.refundSearchCredit(search.organizationId, searchId);
    }
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

    const summary: SearchImportSummary = {
      imported: 0,
      skipped: 0,
      invalid: 0,
      conflicts: 0,
      items: [],
    };
    for (const result of results) {
      if (result.importedLeadId) {
        const activeLead = await this.prisma.lead.findFirst({
          where: { id: result.importedLeadId, organizationId, deletedAt: null },
          select: { id: true },
        });
        if (activeLead) {
          summary.skipped += 1;
          summary.items.push({
            resultId: result.id,
            status: 'SKIPPED',
            leadId: activeLead.id,
          });
          continue;
        }
        await this.prisma.searchResult.updateMany({
          where: { id: result.id, importedLeadId: result.importedLeadId },
          data: { importedLeadId: null },
        });
      }
      const business = this.readNormalizedBusiness(result.normalizedData);
      if (!business) {
        summary.invalid += 1;
        summary.items.push({ resultId: result.id, status: 'INVALID' });
        continue;
      }
      const companyName = business.companyName;
      const outcome = await this.leadIngestion.ingest(organizationId, actorId, this.toLeadCandidate(business));
      if (outcome.status === 'IMPORTED') {
        const linked = await this.linkResultIfUnlinked(result.id, outcome.lead.id);
        if (linked) {
          summary.imported += 1;
          summary.items.push({
            resultId: result.id,
            status: 'IMPORTED',
            leadId: outcome.lead.id,
            companyName,
          });
        } else {
          summary.skipped += 1;
          summary.items.push({
            resultId: result.id,
            status: 'SKIPPED',
            leadId: outcome.lead.id,
            companyName,
          });
        }
      } else if (outcome.status === 'POSSIBLE_DUPLICATE') {
        summary.conflicts += 1;
        summary.items.push({
          resultId: result.id,
          status: 'CONFLICT',
          leadId: outcome.lead?.id,
          companyName,
        });
      } else if (outcome.status === 'SUPPRESSED') {
        summary.skipped += 1;
        summary.items.push({
          resultId: result.id,
          status: 'SKIPPED',
          companyName,
        });
      } else {
        if (outcome.lead) {
          await this.linkResultIfUnlinked(result.id, outcome.lead.id);
        }
        summary.skipped += 1;
        summary.items.push({
          resultId: result.id,
          status: 'SKIPPED',
          leadId: outcome.lead?.id,
          companyName,
        });
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
    try {
      await this.queue.add(
        RUN_SEARCH_JOB,
        {
          searchId: search.id,
          ...(search.correlationId ? { correlationId: search.correlationId } : {}),
        },
        { ...PROSPECTING_JOB_OPTIONS, jobId: search.id },
      );
    } catch (error) {
      if (!isDuplicateJobError(error)) throw error;
    }
    await this.prisma.search.updateMany({
      where: {
        id: search.id,
        status: { in: [SearchStatus.PENDING, SearchStatus.PROCESSING] },
      },
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
      // Empty provider payloads must not delete existing rows. Without a `notIn`
      // filter, `{ searchId }` alone would wipe every result for this search.
      if (externalIds.length > 0) {
        await transaction.searchResult.deleteMany({
          where: {
            searchId,
            externalId: { notIn: externalIds },
          },
        });
      }
    });
  }

  private readSearchInput(value: Prisma.JsonValue): SearchInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException('Invalid persisted search input');
    }
    const input = value as Record<string, unknown>;
    if (
      typeof input.city !== 'string' ||
      typeof input.state !== 'string' ||
      typeof input.onlyWithoutWebsite !== 'boolean'
    ) {
      throw new BadRequestException('Invalid persisted search input');
    }

    const categories = this.resolveCategories({
      category: typeof input.category === 'string' ? input.category : undefined,
      categories: Array.isArray(input.categories)
        ? input.categories.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
    });
    if (categories.length === 0) {
      throw new BadRequestException('Invalid persisted search input');
    }

    const country =
      typeof input.country === 'string' && isProspectingCountryCode(input.country)
        ? input.country
        : 'BR';
    const neighborhood =
      typeof input.neighborhood === 'string' && input.neighborhood.trim()
        ? input.neighborhood.trim()
        : undefined;
    return {
      categories,
      category: categories[0]!,
      city: input.city,
      ...(neighborhood ? { neighborhood } : {}),
      state: input.state,
      country,
      onlyWithoutWebsite: input.onlyWithoutWebsite,
      limit: this.readResultLimit(input.limit),
    };
  }

  /**
   * Older searches may have stored a user-picked volume (20/40/60).
   * New searches always use the system cap; clamp unknown values to the max.
   */
  private readResultLimit(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if ((SEARCH_RESULT_LIMITS as readonly number[]).includes(parsed)) return parsed;
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(Math.floor(parsed), MAX_SEARCH_RESULT_LIMIT);
    }
    return DEFAULT_SEARCH_RESULT_LIMIT;
  }

  private async resolvePlan(organizationId: string): Promise<OrgPlan> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { plan: true, planStatus: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return effectivePlan({ plan: org.plan, planStatus: org.planStatus });
  }

  private async assertCategoriesAllowed(
    organizationId: string,
    categories: string[],
  ): Promise<void> {
    const plan = await this.resolvePlan(organizationId);
    if (plan !== OrgPlan.FREE) return;

    const blocked = categories.filter((category) => !isCategoryAvailable(plan, category));
    if (blocked.length === 0) return;

    throw new ForbiddenException({
      code: 'ENTITLEMENT_CATEGORIES',
      message: 'One or more categories are not available on the current plan',
      requiredPlan: CATEGORY_REQUIRED_PLAN,
      categories: blocked,
    });
  }

  private resolveCategories(input: {
    category?: string;
    categories?: string[];
  }): string[] {
    const fromArray = (input.categories ?? [])
      .map((category) => category.trim())
      .filter(Boolean);
    if (fromArray.length > 0) {
      return [...new Set(fromArray)];
    }
    const single = input.category?.trim();
    return single ? [single] : [];
  }

  private readNormalizedBusiness(value: Prisma.JsonValue): NormalizedBusiness | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const business = value as Record<string, unknown>;
    if (
      typeof business.externalId !== 'string' ||
      typeof business.companyName !== 'string' ||
      typeof business.city !== 'string' ||
      typeof business.state !== 'string' ||
      typeof business.websitePresence !== 'string' ||
      (business.source !== 'OPENSTREETMAP' && business.source !== 'GOOGLE_PLACES')
    ) {
      return null;
    }
    const country =
      typeof business.country === 'string' && isProspectingCountryCode(business.country)
        ? business.country
        : 'BR';
    return { ...(business as unknown as NormalizedBusiness), country };
  }

  private toLeadCandidate(business: NormalizedBusiness): LeadIngestionCandidate {
    const isGoogle = business.source === 'GOOGLE_PLACES';
    const noWebsiteReported = business.websitePresence === WebsitePresence.NO_WEBSITE_REPORTED;
    const websiteFound = business.websitePresence === WebsitePresence.WEBSITE_FOUND;
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
      source: isGoogle ? LeadSource.GOOGLE_PLACES : LeadSource.OPENSTREETMAP,
      externalId: business.externalId,
      status: LeadStatus.TO_REVIEW,
      websitePresence: business.websitePresence,
      websiteCheckedAt: new Date(),
      websiteCheckSource: isGoogle ? 'Google Places' : 'OpenStreetMap',
      websiteStatusReason: noWebsiteReported
        ? 'Fonte não reportou website (observação, não confirmação de ausência).'
        : websiteFound
          ? 'Website reportado pela fonte; validação recomendada.'
          : 'Presença de website precisa de revisão.',
      confidenceLevel: noWebsiteReported
        ? ConfidenceLevel.LOW
        : websiteFound
          ? ConfidenceLevel.MEDIUM
          : ConfidenceLevel.LOW,
      notes: isGoogle
        ? 'Importado do Google Places. Validação manual de website necessária.'
        : 'Importado do OpenStreetMap. Validação manual de website necessária.',
      tags: noWebsiteReported ? ['sem-site'] : [],
    };
  }
}
