import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type {
  ActivityType,
  AnalysisStatus,
  Lead,
  LeadStatus,
  WebsiteAnalysis,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DEFAULT_SCORE_RULES,
  HIGH_RATING_THRESHOLD,
  MANY_REVIEWS_THRESHOLD,
  RECALCULATE_ORG_SCORES_JOB,
  RECALC_BATCH_SIZE,
  RECALC_CONCURRENCY,
  RULE_DIMENSION_BY_KEY,
  SCORE_TOTAL_CAP,
  SCORING_QUEUE,
  SLOW_RESPONSE_MS,
  scoreToTier,
  type AppliedScoreRule,
  type EvaluateRulesResult,
  type RecalculateOrgScoresJobData,
  type RecommendedAction,
  type ScoreDimension,
  type ScoreRuleKey,
} from './scoring.constants';
import type { UpdateScoreRuleItemDto } from './dto/update-score-rules.dto';

type LeadForScoring = Pick<
  Lead,
  | 'id'
  | 'organizationId'
  | 'website'
  | 'phone'
  | 'email'
  | 'rating'
  | 'reviewCount'
  | 'status'
  | 'segment'
  | 'doNotContact'
>;

type AnalysisForScoring = Pick<
  WebsiteAnalysis,
  | 'status'
  | 'https'
  | 'hasViewport'
  | 'responseTimeMs'
  | 'hasContactForm'
  | 'metaDescription'
  | 'httpStatus'
  | 'error'
>;

type BehaviorSignals = {
  activityTypes: ActivityType[];
};

const OUTREACH_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set([
  'CALL',
  'EMAIL',
  'WHATSAPP',
  'MEETING',
  'PROPOSAL_SENT',
]);

const ENGAGEMENT_STATUS_RULES: Array<{ key: ScoreRuleKey; statuses: ReadonlySet<LeadStatus> }> = [
  {
    key: 'ENGAGEMENT_CONTACTED',
    statuses: new Set([
      'CONTACTED',
      'RESPONDED',
      'MEETING_SCHEDULED',
      'PROPOSAL_SENT',
      'NEGOTIATION',
      'WON',
    ]),
  },
  {
    key: 'ENGAGEMENT_RESPONDED',
    statuses: new Set([
      'RESPONDED',
      'MEETING_SCHEDULED',
      'PROPOSAL_SENT',
      'NEGOTIATION',
      'WON',
    ]),
  },
  {
    key: 'ENGAGEMENT_MEETING',
    statuses: new Set(['MEETING_SCHEDULED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON']),
  },
  {
    key: 'ENGAGEMENT_PROPOSAL',
    statuses: new Set(['PROPOSAL_SENT', 'NEGOTIATION', 'WON']),
  },
  {
    key: 'ENGAGEMENT_NEGOTIATION',
    statuses: new Set(['NEGOTIATION', 'WON']),
  },
  {
    key: 'ENGAGEMENT_WON',
    statuses: new Set(['WON']),
  },
];

@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCORING_QUEUE)
    private readonly queue: Queue<RecalculateOrgScoresJobData>,
  ) {}

  async ensureDefaultConfig(organizationId: string) {
    const existing = await this.prisma.scoreConfiguration.findFirst({
      where: { organizationId, isActive: true },
      include: { rules: { orderBy: { key: 'asc' } } },
    });
    if (existing) {
      await this.ensureCatalogRules(
        existing.id,
        existing.rules.map((rule) => rule.key),
      );
      return this.prisma.scoreConfiguration.findFirstOrThrow({
        where: { id: existing.id },
        include: { rules: { orderBy: { key: 'asc' } } },
      });
    }

    return this.prisma.scoreConfiguration.create({
      data: {
        organizationId,
        name: 'default',
        version: 1,
        isActive: true,
        rules: {
          create: DEFAULT_SCORE_RULES.map((rule) => ({
            key: rule.key,
            description: rule.description,
            points: rule.points,
            enabled: true,
          })),
        },
      },
      include: { rules: { orderBy: { key: 'asc' } } },
    });
  }

  async getConfig(organizationId: string) {
    return this.ensureDefaultConfig(organizationId);
  }

  async updateRules(organizationId: string, updates: UpdateScoreRuleItemDto[]) {
    const config = await this.ensureDefaultConfig(organizationId);

    await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.scoreRule.update({
          where: { configId_key: { configId: config.id, key: update.key } },
          data: {
            ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
            ...(update.points !== undefined ? { points: update.points } : {}),
          },
        });
      }
      await tx.scoreConfiguration.update({
        where: { id: config.id },
        data: { version: { increment: 1 } },
      });
    });

    await this.queue.add(
      RECALCULATE_ORG_SCORES_JOB,
      { organizationId },
      {
        jobId: `recalc-org-${organizationId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
      },
    );

    return this.getConfig(organizationId);
  }

  async recalculateOrganization(
    organizationId: string,
    options?: { batchSize?: number; concurrency?: number },
  ): Promise<number> {
    const batchSize = options?.batchSize ?? RECALC_BATCH_SIZE;
    const concurrency = options?.concurrency ?? RECALC_CONCURRENCY;
    let cursor: string | undefined;
    let processed = 0;

    for (;;) {
      const batch = await this.prisma.lead.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (batch.length === 0) {
        break;
      }

      await this.mapWithConcurrency(batch, concurrency, async (lead) => {
        await this.recalculate(lead.id);
      });

      processed += batch.length;
      cursor = batch[batch.length - 1]?.id;
      if (batch.length < batchSize) {
        break;
      }
    }

    return processed;
  }

  async recalculate(leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, deletedAt: null },
      select: {
        id: true,
        organizationId: true,
        website: true,
        phone: true,
        email: true,
        rating: true,
        reviewCount: true,
        status: true,
        segment: true,
        doNotContact: true,
        activities: {
          select: { type: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        websiteRecord: {
          include: {
            analyses: {
              where: { status: 'COMPLETED' },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const config = await this.ensureDefaultConfig(lead.organizationId);
    const analysis = lead.websiteRecord?.analyses[0] ?? null;
    const result = this.evaluateRules(lead, analysis, config.rules, {
      activityTypes: lead.activities.map((activity) => activity.type),
    });

    await this.prisma.$transaction([
      this.prisma.leadScore.create({
        data: {
          leadId: lead.id,
          score: result.score,
          fit: result.fit,
          opportunity: result.opportunity,
          engagement: result.engagement,
          tier: result.tier,
          rulesApplied: result.applied as unknown as Prisma.InputJsonValue,
          missingData: result.missingData as unknown as Prisma.InputJsonValue,
          recommendedAction: result.recommendedAction,
          configVersion: config.version,
        },
      }),
      this.prisma.lead.update({
        where: { id: lead.id },
        data: { score: result.score },
      }),
    ]);

    return {
      score: result.score,
      fit: result.fit,
      opportunity: result.opportunity,
      engagement: result.engagement,
      tier: result.tier,
      appliedRules: result.applied,
      missingData: result.missingData,
      recommendedAction: result.recommendedAction,
      configVersion: config.version,
    };
  }

  evaluateRules(
    lead: LeadForScoring,
    analysis: AnalysisForScoring | null,
    rules: Array<{ key: string; points: number; enabled: boolean }>,
    signals: BehaviorSignals = { activityTypes: [] },
  ): EvaluateRulesResult {
    const enabled = new Map(
      rules.filter((rule) => rule.enabled).map((rule) => [rule.key as ScoreRuleKey, rule.points]),
    );
    const applied: AppliedScoreRule[] = [];

    const push = (key: ScoreRuleKey) => {
      const points = enabled.get(key);
      if (points === undefined) return;
      const dimension = RULE_DIMENSION_BY_KEY[key];
      applied.push({ key, points, dimension });
    };

    const hasWebsite = Boolean(lead.website?.trim());
    if (!hasWebsite) {
      push('NO_WEBSITE');
    } else if (analysis && analysis.status === ('COMPLETED' as AnalysisStatus)) {
      if (analysis.https === false) push('NO_HTTPS');
      if (analysis.hasViewport === false) push('NOT_RESPONSIVE');
      if (
        typeof analysis.responseTimeMs === 'number' &&
        analysis.responseTimeMs >= SLOW_RESPONSE_MS
      ) {
        push('SLOW');
      }
      if (analysis.hasContactForm === false) push('NO_CONTACT_FORM');
      if (!analysis.metaDescription?.trim()) push('NO_META_DESCRIPTION');

      const siteIsWeak =
        analysis.https === false ||
        analysis.hasViewport === false ||
        (typeof analysis.httpStatus === 'number' && analysis.httpStatus >= 400) ||
        Boolean(analysis.error);
      if (
        siteIsWeak &&
        typeof lead.reviewCount === 'number' &&
        lead.reviewCount >= MANY_REVIEWS_THRESHOLD
      ) {
        push('MANY_REVIEWS_BAD_SITE');
      }
    }

    if (lead.phone?.trim()) push('HAS_PHONE');
    if (lead.email?.trim()) push('HAS_EMAIL');
    if (typeof lead.rating === 'number' && lead.rating >= HIGH_RATING_THRESHOLD) {
      push('HIGH_RATING');
    }

    for (const rule of ENGAGEMENT_STATUS_RULES) {
      if (rule.statuses.has(lead.status)) {
        push(rule.key);
      }
    }

    if (signals.activityTypes.some((type) => OUTREACH_ACTIVITY_TYPES.has(type))) {
      push('ENGAGEMENT_ACTIVITY');
    }

    const dimensions = this.sumDimensions(applied);
    const rawScore = dimensions.fit + dimensions.opportunity + dimensions.engagement;
    const score = Math.max(0, Math.min(SCORE_TOTAL_CAP, rawScore));
    const missingData = this.collectMissingData(lead, analysis);
    const recommendedAction = this.recommendAction({
      doNotContact: lead.doNotContact,
      missingData,
      hasWebsite,
      hasContact: Boolean(lead.phone?.trim() || lead.email?.trim()),
      fit: dimensions.fit,
      opportunity: dimensions.opportunity,
      engagement: dimensions.engagement,
    });

    return {
      applied,
      fit: dimensions.fit,
      opportunity: dimensions.opportunity,
      engagement: dimensions.engagement,
      score,
      tier: scoreToTier(score),
      missingData,
      recommendedAction,
    };
  }

  private sumDimensions(applied: AppliedScoreRule[]): Record<ScoreDimension, number> {
    const totals: Record<ScoreDimension, number> = {
      fit: 0,
      opportunity: 0,
      engagement: 0,
    };
    for (const rule of applied) {
      totals[rule.dimension] += rule.points;
    }
    return totals;
  }

  private collectMissingData(
    lead: LeadForScoring,
    analysis: AnalysisForScoring | null,
  ): string[] {
    const missing: string[] = [];
    if (!lead.phone?.trim()) missing.push('phone');
    if (!lead.email?.trim()) missing.push('email');
    if (!lead.website?.trim()) missing.push('website');
    if (!lead.segment?.trim()) missing.push('segment');
    if (lead.website?.trim() && !analysis) missing.push('websiteAnalysis');
    if (typeof lead.rating !== 'number') missing.push('rating');
    return missing;
  }

  private recommendAction(input: {
    doNotContact: boolean;
    missingData: string[];
    hasWebsite: boolean;
    hasContact: boolean;
    fit: number;
    opportunity: number;
    engagement: number;
  }): RecommendedAction {
    if (input.doNotContact) return 'RESPECT_DNC';
    if (input.missingData.includes('phone') && input.missingData.includes('email')) {
      return 'ENRICH_CONTACT';
    }
    if (input.engagement >= 12) return 'ADVANCE_PIPELINE';
    if (input.hasWebsite && input.missingData.includes('websiteAnalysis')) {
      return 'RUN_WEBSITE_ANALYSIS';
    }
    if (input.opportunity >= 30 && input.hasContact) return 'PRIORITIZE_OUTREACH';
    if (input.fit < 5) return 'ENRICH_PROFILE';
    return 'NURTURE';
  }

  private async mapWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    if (items.length === 0) return;
    const limit = Math.max(1, concurrency);
    let index = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        const item = items[current];
        if (item === undefined) continue;
        await worker(item);
      }
    });

    await Promise.all(runners);
  }

  private async ensureCatalogRules(configId: string, existingKeys: string[]) {
    const missing = DEFAULT_SCORE_RULES.filter((rule) => !existingKeys.includes(rule.key));
    if (missing.length === 0) return;
    await this.prisma.scoreRule.createMany({
      data: missing.map((rule) => ({
        configId,
        key: rule.key,
        description: rule.description,
        points: rule.points,
        enabled: true,
      })),
      skipDuplicates: true,
    });
  }
}
