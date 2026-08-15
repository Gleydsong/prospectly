import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ConfidenceLevel,
  LeadSource,
  LeadStatus,
  OpportunityCandidateStatus,
  OpportunityRunStatus,
  Prisma,
  WebsitePresence,
} from '@prisma/client';
import type {
  OpportunityCandidateView,
  OpportunityCompany,
  OpportunityExplanation,
  OpportunityProfile,
  OpportunityRunView,
  OpportunitySearchStrategy,
  WebsiteAnalyzer,
} from '@prospectly/shared-types';
import type { Queue } from 'bullmq';

import { PrismaService } from '../../common/prisma/prisma.service';
import { StructuredAiService } from '../ai/structured-ai.service';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { CREDIT_COSTS } from '../billing/billing.constants';
import { LeadIngestionService } from '../leads/lead-ingestion.service';
import type { NormalizedBusiness } from '../prospecting/domain/normalized-business';
import { mergeProviderResults } from '../prospecting/domain/merge-search-results';
import {
  SEARCH_PROVIDER_REGISTRY,
  type SearchProviderRegistry,
} from '../prospecting/domain/search-provider';
import { ProspectingService } from '../prospecting/prospecting.service';
import { WEBSITE_ANALYZER } from '../website-analysis/website-analysis.tokens';
import {
  OPPORTUNITY_EXPLANATION_PROMPT_VERSION,
  OPPORTUNITY_FINDER_QUEUE,
  OPPORTUNITY_JOB_OPTIONS,
  OPPORTUNITY_LIMITS,
  OPPORTUNITY_PROFILE_PROMPT_VERSION,
  OPPORTUNITY_SCORE_VERSION,
  OPPORTUNITY_STRATEGY_PROMPT_VERSION,
  PROCESS_OPPORTUNITY_RUN_JOB,
  type ProcessOpportunityRunJobData,
} from './opportunity-finder.constants';
import {
  buildDeterministicOpportunityProfile,
  buildDeterministicSearchStrategy,
  OpportunityProfileSchema,
  OpportunitySearchStrategySchema,
} from './domain/opportunity-profile';
import { buildOpportunitySignals, scoreOpportunity } from './domain/opportunity-scoring';
import type { CreateOpportunityRunDto } from './dto/create-opportunity-run.dto';
import type { QueryOpportunityCandidatesDto } from './dto/query-opportunity-candidates.dto';

@Injectable()
export class OpportunityFinderService {
  private readonly logger = new Logger(OpportunityFinderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OPPORTUNITY_FINDER_QUEUE) private readonly queue: Queue<ProcessOpportunityRunJobData>,
    @Inject(SEARCH_PROVIDER_REGISTRY) private readonly providers: SearchProviderRegistry,
    @Inject(WEBSITE_ANALYZER) private readonly websiteAnalyzer: WebsiteAnalyzer,
    private readonly prospecting: ProspectingService,
    private readonly billing: BillingService,
    private readonly ai: StructuredAiService,
    private readonly leadIngestion: LeadIngestionService,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateOpportunityRunDto,
    correlationId?: string,
  ): Promise<OpportunityRunView> {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.opportunityRun.findUnique({
        where: { organizationId_idempotencyKey: { organizationId, idempotencyKey: dto.idempotencyKey } },
      });
      if (existing) return this.toRunView(existing);
    }
    await this.billing.assertCanCreateSearch(organizationId, CREDIT_COSTS.opportunityFinder);
    if (!this.providers.list().some((provider) => provider.available)) {
      throw new BadRequestException('No company search provider is available');
    }

    const runData = {
      organizationId,
      userId,
      service: dto.service,
      city: dto.city,
      state: dto.state,
      country: 'BR',
      idempotencyKey: dto.idempotencyKey,
      correlationId,
      scoringVersion: OPPORTUNITY_SCORE_VERSION,
    };
    let run;
    try {
      run = await this.prisma.opportunityRun.create({ data: runData });
    } catch (error) {
      if (dto.idempotencyKey && this.isUniqueConstraintError(error)) {
        const concurrent = await this.prisma.opportunityRun.findUnique({
          where: {
            organizationId_idempotencyKey: {
              organizationId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        });
        if (concurrent) return this.toRunView(concurrent);
      }
      throw error;
    }
    try {
      await this.billing.consumeCreditForOpportunityRun(organizationId, run.id);
      await this.queue.add(
        PROCESS_OPPORTUNITY_RUN_JOB,
        { runId: run.id, correlationId },
        { ...OPPORTUNITY_JOB_OPTIONS, jobId: run.id },
      );
    } catch (error) {
      await this.billing.refundOpportunityRunCredit(organizationId, run.id);
      await this.prisma.opportunityRun.delete({ where: { id: run.id } });
      throw error;
    }
    await this.audit.log({ organizationId, userId, action: 'OPPORTUNITY_RUN_CREATED', entity: 'OpportunityRun', entityId: run.id, metadata: { city: dto.city, state: dto.state } });
    return this.toRunView(run);
  }

  async get(organizationId: string, id: string): Promise<OpportunityRunView> {
    return this.toRunView(await this.requireRun(organizationId, id));
  }

  async listCandidates(
    organizationId: string,
    runId: string,
    query: QueryOpportunityCandidatesDto,
  ): Promise<{ data: OpportunityCandidateView[]; total: number }> {
    await this.requireRun(organizationId, runId);
    const where = { runId, ...(query.category ? { rankingCategory: query.category } : {}) };
    const [candidates, total] = await Promise.all([
      this.prisma.opportunityCandidate.findMany({
        where,
        orderBy: [{ overallScore: 'desc' }, { confidenceScore: 'desc' }],
        take: query.pageSize,
      }),
      this.prisma.opportunityCandidate.count({ where }),
    ]);
    return { data: candidates.map((candidate) => this.toCandidateView(candidate)), total };
  }

  async getCandidate(organizationId: string, runId: string, candidateId: string) {
    await this.requireRun(organizationId, runId);
    const candidate = await this.prisma.opportunityCandidate.findFirst({ where: { id: candidateId, runId } });
    if (!candidate) throw new NotFoundException('Opportunity candidate not found');
    return this.toCandidateView(candidate);
  }

  async explainCandidate(organizationId: string, userId: string, runId: string, candidateId: string) {
    const run = await this.requireRun(organizationId, runId);
    const candidate = await this.prisma.opportunityCandidate.findFirst({ where: { id: candidateId, runId } });
    if (!candidate) throw new NotFoundException('Opportunity candidate not found');
    if (candidate.explanation) return this.toCandidateView(candidate);
    await this.billing.consumeCreditForExplain(organizationId, candidate.id, run.id);
    try {
      const explanation = await this.generateExplanation(run, candidate, userId);
      const updated = await this.prisma.opportunityCandidate.update({
        where: { id: candidate.id },
        data: { explanation: explanation as unknown as Prisma.InputJsonValue, explanationPromptVersion: OPPORTUNITY_EXPLANATION_PROMPT_VERSION },
      });
      return this.toCandidateView(updated);
    } catch (error) {
      await this.billing.refundExplainCredit(organizationId, candidate.id);
      throw error;
    }
  }

  async saveAsLead(organizationId: string, userId: string, runId: string, candidateId: string) {
    await this.requireRun(organizationId, runId);
    const candidate = await this.prisma.opportunityCandidate.findFirst({ where: { id: candidateId, runId } });
    if (!candidate) throw new NotFoundException('Opportunity candidate not found');
    if (candidate.importedLeadId) return { status: 'ALREADY_SAVED' as const, leadId: candidate.importedLeadId };
    await this.billing.consumeCreditForSaveLead(organizationId, candidate.id, runId);
    try {
      const company = candidate.company as unknown as OpportunityCompany;
      const noWebsiteReported = company.websitePresence === 'NO_WEBSITE_REPORTED';
      const outcome = await this.leadIngestion.ingest(organizationId, userId, {
        companyName: company.companyName,
        category: company.category,
        phone: company.phone,
        email: company.email,
        website: company.website,
        address: company.address,
        city: company.city,
        state: company.state,
        country: 'BR',
        postalCode: company.postalCode,
        latitude: company.latitude,
        longitude: company.longitude,
        rating: company.rating,
        reviewCount: company.reviewCount,
        source: company.source === 'GOOGLE_PLACES' ? LeadSource.GOOGLE_PLACES : LeadSource.OPENSTREETMAP,
        externalId: company.externalId,
        status: LeadStatus.TO_REVIEW,
        websitePresence: company.websitePresence as WebsitePresence,
        websiteCheckedAt: new Date(),
        websiteCheckSource: 'AI Opportunity Finder',
        websiteStatusReason: noWebsiteReported
          ? 'Fonte não reportou website; ausência não confirmada.'
          : 'Website reportado pela fonte e analisado quando tecnicamente acessível.',
        confidenceLevel: noWebsiteReported ? ConfidenceLevel.LOW : ConfidenceLevel.MEDIUM,
        notes: `Opportunity Finder: score ${candidate.overallScore}/100, confiança ${candidate.confidenceScore}%.`,
        tags: ['opportunity-finder'],
      });
      const lead = outcome.lead;
      if (lead) {
        await this.prisma.opportunityCandidate.updateMany({ where: { id: candidate.id, importedLeadId: null }, data: { importedLeadId: lead.id } });
      }
      await this.audit.log({ organizationId, userId, action: 'OPPORTUNITY_SAVED_AS_LEAD', entity: 'OpportunityCandidate', entityId: candidate.id, metadata: { outcome: outcome.status, leadId: lead?.id } });
      return { status: outcome.status, leadId: lead?.id ?? null };
    } catch (error) {
      await this.billing.refundSaveLeadCredit(organizationId, candidate.id);
      throw error;
    }
  }

  async getJobContext(runId: string): Promise<{ organizationId: string; correlationId: string | null } | null> {
    const run = await this.prisma.opportunityRun.findUnique({
      where: { id: runId },
      select: { organizationId: true, correlationId: true },
    });
    if (!run) return null;
    return { organizationId: run.organizationId, correlationId: run.correlationId };
  }

  async processRun(runId: string): Promise<void> {
    const run = await this.prisma.opportunityRun.findUnique({ where: { id: runId } });
    if (!run || run.status === OpportunityRunStatus.CANCELLED || run.status === OpportunityRunStatus.COMPLETED) return;
    const deadline = Date.now() + OPPORTUNITY_LIMITS.maxDurationMs;
    const context = { organizationId: run.organizationId, userId: run.userId, opportunityRunId: run.id };

    await this.prisma.opportunityRun.update({ where: { id: run.id }, data: { status: OpportunityRunStatus.PREPARING, errorCode: null, errorMessage: null } });
    const aiProfile = await this.ai.buildOpportunityProfile(context, run.service);
    const profile = OpportunityProfileSchema.parse(aiProfile ?? buildDeterministicOpportunityProfile(run.service));
    const catalog = await this.prospecting.listCategories(run.organizationId);
    const available = new Set(catalog.categories.filter((category) => category.available).map((category) => category.value));
    profile.categories = profile.categories.filter((category) => available.has(category));
    if (profile.categories.length === 0) profile.categories = catalog.categories.filter((category) => category.available).slice(0, 5).map((category) => category.value);
    const aiStrategy = await this.ai.buildSearchStrategy(context, profile);
    const strategy = OpportunitySearchStrategySchema.parse(aiStrategy ?? buildDeterministicSearchStrategy(profile));
    strategy.categories = strategy.categories.filter((category) => available.has(category));
    if (strategy.categories.length === 0) strategy.categories = profile.categories;

    await this.prisma.opportunityRun.update({
      where: { id: run.id },
      data: {
        status: OpportunityRunStatus.SEARCHING,
        profile: profile as unknown as Prisma.InputJsonValue,
        searchStrategy: strategy as unknown as Prisma.InputJsonValue,
        profilePromptVersion: OPPORTUNITY_PROFILE_PROMPT_VERSION,
        strategyPromptVersion: OPPORTUNITY_STRATEGY_PROMPT_VERSION,
      },
    });

    const providerIds = this.providers.list().filter((provider) => provider.available).map((provider) => provider.id);
    const settled = await Promise.allSettled(providerIds.map((providerId) => this.providers.resolve(providerId).search({
      category: strategy.categories[0]!,
      categories: strategy.categories,
      city: run.city,
      state: run.state,
      country: 'BR',
      onlyWithoutWebsite: false,
      limit: OPPORTUNITY_LIMITS.maxCandidates,
    })));
    const businesses = mergeProviderResults(settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
      .filter((business) => strategy.minimumRating == null || business.rating == null || business.rating >= strategy.minimumRating)
      .filter((business) => strategy.minimumReviews == null || business.reviewCount == null || business.reviewCount >= strategy.minimumReviews)
      .slice(0, OPPORTUNITY_LIMITS.maxCandidates);
    if (businesses.length === 0) throw new Error('NO_COMPANIES_FOUND');
    await this.prisma.opportunityRun.update({ where: { id: run.id }, data: { status: OpportunityRunStatus.ANALYZING, candidateCount: businesses.length } });

    let analyzed = 0;
    let failed = 0;
    await this.mapWithConcurrency(businesses, OPPORTUNITY_LIMITS.analysisConcurrency, async (business) => {
      if (Date.now() > deadline) { failed += 1; return; }
      try {
        const company = this.toOpportunityCompany(business);
        const websiteAnalysis = company.website ? await this.websiteAnalyzer.analyze(company.website) : null;
        const signals = buildOpportunitySignals(company, websiteAnalysis);
        const scored = scoreOpportunity(company, profile, signals);
        await this.prisma.opportunityCandidate.upsert({
          where: { runId_externalId: { runId: run.id, externalId: company.externalId } },
          create: {
            runId: run.id,
            status: OpportunityCandidateStatus.SCORED,
            externalId: company.externalId,
            provider: company.source,
            company: company as unknown as Prisma.InputJsonValue,
            websiteAnalysis: websiteAnalysis as unknown as Prisma.InputJsonValue,
            signals: signals as unknown as Prisma.InputJsonValue,
            scoreBreakdown: scored.breakdown as unknown as Prisma.InputJsonValue,
            overallScore: scored.overall,
            confidenceScore: scored.confidence,
            dataCompleteness: scored.completeness,
            rankingCategory: scored.category,
            analyzedAt: new Date(),
          },
          update: {
            status: OpportunityCandidateStatus.SCORED,
            company: company as unknown as Prisma.InputJsonValue,
            websiteAnalysis: websiteAnalysis as unknown as Prisma.InputJsonValue,
            signals: signals as unknown as Prisma.InputJsonValue,
            scoreBreakdown: scored.breakdown as unknown as Prisma.InputJsonValue,
            overallScore: scored.overall,
            confidenceScore: scored.confidence,
            dataCompleteness: scored.completeness,
            rankingCategory: scored.category,
            analyzedAt: new Date(),
          },
        });
        analyzed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn({ message: 'Opportunity candidate analysis failed', runId: run.id, externalId: business.externalId, error: error instanceof Error ? error.message : 'unknown' });
      }
    });

    await this.prisma.opportunityRun.update({ where: { id: run.id }, data: { status: OpportunityRunStatus.RANKING, analyzedCount: analyzed, failedCount: failed } });
    const top = await this.prisma.opportunityCandidate.findMany({ where: { runId: run.id }, orderBy: [{ overallScore: 'desc' }, { confidenceScore: 'desc' }], take: OPPORTUNITY_LIMITS.maxAiExplanations });
    for (const candidate of top) {
      if (Date.now() > deadline) break;
      const explanation = await this.generateExplanation(run, candidate, run.userId);
      await this.prisma.opportunityCandidate.update({ where: { id: candidate.id }, data: { explanation: explanation as unknown as Prisma.InputJsonValue, explanationPromptVersion: OPPORTUNITY_EXPLANATION_PROMPT_VERSION } });
    }

    const partial = failed > 0 || settled.some((result) => result.status === 'rejected');
    await this.prisma.opportunityRun.update({
      where: { id: run.id },
      data: { status: partial ? OpportunityRunStatus.PARTIAL : OpportunityRunStatus.COMPLETED, analyzedCount: analyzed, failedCount: failed, completedAt: new Date() },
    });
  }

  async recordFailure(runId: string, code = 'PROCESSING_FAILED'): Promise<void> {
    const run = await this.prisma.opportunityRun.findUnique({
      where: { id: runId },
      select: { organizationId: true, status: true },
    });
    if (!run) return;
    const terminal: OpportunityRunStatus[] = [
      OpportunityRunStatus.COMPLETED,
      OpportunityRunStatus.PARTIAL,
      OpportunityRunStatus.CANCELLED,
    ];
    if (terminal.includes(run.status)) return;
    const publicCode = code === 'NO_COMPANIES_FOUND' ? code : 'PROCESSING_FAILED';
    await this.prisma.opportunityRun.updateMany({
      where: { id: runId, status: { notIn: terminal } },
      data: { status: OpportunityRunStatus.FAILED, errorCode: publicCode, errorMessage: 'Não foi possível concluir a análise. Tente novamente.', completedAt: new Date() },
    });
    await this.billing.refundOpportunityRunCredit(run.organizationId, runId, publicCode);
  }

  private async generateExplanation(run: { id: string; organizationId: string; userId: string; service: string }, candidate: { id: string; company: Prisma.JsonValue; signals: Prisma.JsonValue; scoreBreakdown: Prisma.JsonValue }, userId: string): Promise<OpportunityExplanation> {
    const rawCompany = candidate.company as unknown as OpportunityCompany;
    const company: Record<string, unknown> = {
      companyName: rawCompany.companyName,
      category: rawCompany.category,
      city: rawCompany.city,
      state: rawCompany.state,
      rating: rawCompany.rating,
      reviewCount: rawCompany.reviewCount,
      websitePresence: rawCompany.websitePresence,
    };
    const signals = candidate.signals as unknown as OpportunityCandidateView['signals'];
    const scoreBreakdown = candidate.scoreBreakdown as unknown as OpportunityCandidateView['scoreBreakdown'];
    const ai = await this.ai.explainOpportunity({ organizationId: run.organizationId, userId, opportunityRunId: run.id, candidateId: candidate.id }, { service: run.service, company, signals, scoreBreakdown });
    if (ai) return ai;
    const companyName = typeof company.companyName === 'string' ? company.companyName : 'A empresa';
    const strongest = signals.filter((entry) => entry.value === 'TRUE').slice(0, 3).map((entry) => entry.evidence);
    return {
      summary: `${companyName} apresenta sinais verificáveis que merecem análise comercial.`,
      whyOpportunity: strongest.length ? strongest.join(' ') : 'Os dados disponíveis são insuficientes para uma conclusão forte.',
      recommendedOffer: `Apresente ${run.service} como hipótese de melhoria, sujeita à validação humana.`,
      commercialAngle: 'Comece pelos fatos observados e faça uma pergunta aberta, sem afirmar necessidades não confirmadas.',
      warnings: ['Valide manualmente os sinais antes de contactar a empresa.'],
      source: 'DETERMINISTIC_FALLBACK',
    };
  }

  private toOpportunityCompany(business: NormalizedBusiness): OpportunityCompany {
    let website: string | undefined;
    if (business.website) {
      try {
        const parsed = new URL(business.website);
        website = ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : undefined;
      } catch {
        website = undefined;
      }
    }
    return {
      ...business,
      website,
      country: 'BR',
      websitePresence: website ? 'WEBSITE_FOUND' : business.websitePresence as OpportunityCompany['websitePresence'],
    };
  }

  private async requireRun(organizationId: string, id: string) {
    const run = await this.prisma.opportunityRun.findFirst({ where: { id, organizationId } });
    if (!run) throw new NotFoundException('Opportunity run not found');
    return run;
  }

  private toRunView(run: { id: string; status: OpportunityRunStatus; service: string; city: string; state: string; country: string; profile: Prisma.JsonValue | null; searchStrategy: Prisma.JsonValue | null; scoringVersion: string; candidateCount: number; analyzedCount: number; failedCount: number; errorCode: string | null; errorMessage: string | null; startedAt: Date; completedAt: Date | null; createdAt: Date }): OpportunityRunView {
    return { ...run, country: 'BR', profile: run.profile as unknown as OpportunityProfile | null, searchStrategy: run.searchStrategy as unknown as OpportunitySearchStrategy | null, startedAt: run.startedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null, createdAt: run.createdAt.toISOString() };
  }

  private toCandidateView(candidate: { id: string; runId: string; status: OpportunityCandidateStatus; company: Prisma.JsonValue; signals: Prisma.JsonValue; scoreBreakdown: Prisma.JsonValue; overallScore: number; confidenceScore: number; dataCompleteness: number; rankingCategory: string; explanation: Prisma.JsonValue | null; importedLeadId: string | null; analyzedAt: Date | null }): OpportunityCandidateView {
    return { id: candidate.id, runId: candidate.runId, status: candidate.status, company: candidate.company as unknown as OpportunityCompany, signals: candidate.signals as unknown as OpportunityCandidateView['signals'], scoreBreakdown: candidate.scoreBreakdown as unknown as OpportunityCandidateView['scoreBreakdown'], overallScore: candidate.overallScore, confidenceScore: candidate.confidenceScore, dataCompleteness: candidate.dataCompleteness, rankingCategory: candidate.rankingCategory as OpportunityCandidateView['rankingCategory'], explanation: candidate.explanation as unknown as OpportunityExplanation | null, importedLeadId: candidate.importedLeadId, analyzedAt: candidate.analyzedAt?.toISOString() ?? null };
  }

  private async mapWithConcurrency<T>(items: T[], concurrency: number, task: (item: T) => Promise<void>): Promise<void> {
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const index = cursor++;
        const item = items[index];
        if (item === undefined) return;
        await task(item);
      }
    }));
  }

  private isUniqueConstraintError(error: unknown): error is { code: 'P2002' } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
