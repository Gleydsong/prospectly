import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { AnalysisStatus, Lead, WebsiteAnalysis } from '@prisma/client';
import type { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  DEFAULT_SCORE_RULES,
  HIGH_RATING_THRESHOLD,
  MANY_REVIEWS_THRESHOLD,
  RECALCULATE_ORG_SCORES_JOB,
  SCORE_TOTAL_CAP,
  SCORING_QUEUE,
  SLOW_RESPONSE_MS,
  scoreToTier,
  type RecalculateOrgScoresJobData,
  type ScoreRuleKey,
} from './scoring.constants';
import type { UpdateScoreRuleItemDto } from './dto/update-score-rules.dto';

type LeadForScoring = Pick<
  Lead,
  'id' | 'organizationId' | 'website' | 'phone' | 'email' | 'rating' | 'reviewCount'
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
      await this.ensureCatalogRules(existing.id, existing.rules.map((rule) => rule.key));
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

  async updateRules(organizationId: string, updates: UpdateScoreRuleItemDto[], correlationId?: string) {
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
      {
        organizationId,
        ...(correlationId ? { correlationId } : {}),
      },
      {
        jobId: `recalc-org-${organizationId}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
      },
    );

    return this.getConfig(organizationId);
  }

  async recalculateOrganization(organizationId: string): Promise<number> {
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true },
      take: 5000,
    });
    for (const lead of leads) {
      await this.recalculate(lead.id);
    }
    return leads.length;
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
    const applied = this.evaluateRules(lead, analysis, config.rules);

    const rawScore = applied.reduce((sum, rule) => sum + rule.points, 0);
    const score = Math.max(0, Math.min(SCORE_TOTAL_CAP, rawScore));
    const tier = scoreToTier(score);

    await this.prisma.$transaction([
      this.prisma.leadScore.create({
        data: {
          leadId: lead.id,
          score,
          tier,
          rulesApplied: applied as unknown as Prisma.InputJsonValue,
          configVersion: config.version,
        },
      }),
      this.prisma.lead.update({
        where: { id: lead.id },
        data: { score },
      }),
    ]);

    return { score, tier, appliedRules: applied, configVersion: config.version };
  }

  evaluateRules(
    lead: LeadForScoring,
    analysis: AnalysisForScoring | null,
    rules: Array<{ key: string; points: number; enabled: boolean }>,
  ): Array<{ key: string; points: number }> {
    const enabled = new Map(
      rules.filter((rule) => rule.enabled).map((rule) => [rule.key as ScoreRuleKey, rule.points]),
    );
    const applied: Array<{ key: string; points: number }> = [];

    const push = (key: ScoreRuleKey) => {
      const points = enabled.get(key);
      if (points === undefined) return;
      applied.push({ key, points });
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

    return applied;
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
