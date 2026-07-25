import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { WebsiteAnalyzer } from '@prospectly/shared-types';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ScoringService } from '../scoring/scoring.service';
import {
  ANALYZE_WEBSITE_JOB,
  WEBSITE_ANALYSIS_QUEUE,
  type AnalyzeWebsiteJobData,
} from './website-analysis.constants';
import { WEBSITE_ANALYZER } from './website-analysis.tokens';

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, '') || null;
  } catch {
    return null;
  }
}

function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

@Injectable()
export class WebsiteAnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringService,
    @Inject(WEBSITE_ANALYZER) private readonly analyzer: WebsiteAnalyzer,
    @InjectQueue(WEBSITE_ANALYSIS_QUEUE)
    private readonly queue: Queue<AnalyzeWebsiteJobData>,
  ) {}

  async enqueueForLead(organizationId: string, leadId: string, force = false) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true, website: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const websiteUrl = lead.website ? normalizeWebsiteUrl(lead.website) : '';
    if (!websiteUrl) {
      await this.scoring.recalculate(leadId);
      return { queued: false as const, reason: 'NO_WEBSITE' as const };
    }

    let website = await this.prisma.website.findUnique({ where: { leadId } });
    if (!website) {
      website = await this.prisma.website.create({
        data: {
          leadId,
          url: websiteUrl,
          domain: extractDomain(websiteUrl),
        },
      });
    } else if (website.url !== websiteUrl) {
      website = await this.prisma.website.update({
        where: { id: website.id },
        data: { url: websiteUrl, domain: extractDomain(websiteUrl) },
      });
    }

    const active = await this.prisma.websiteAnalysis.findFirst({
      where: {
        websiteId: website.id,
        status: { in: ['PENDING', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (active && !force) {
      return {
        queued: false as const,
        reason: 'ALREADY_QUEUED' as const,
        analysisId: active.id,
        status: active.status,
      };
    }

    const analysis = await this.prisma.websiteAnalysis.create({
      data: {
        websiteId: website.id,
        status: 'PENDING',
      },
    });

    await this.queue.add(
      ANALYZE_WEBSITE_JOB,
      {
        organizationId,
        leadId,
        analysisId: analysis.id,
        url: websiteUrl,
      },
      {
        jobId: `analyze-${leadId}-${analysis.id}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    return {
      queued: true as const,
      analysisId: analysis.id,
      status: analysis.status,
    };
  }

  async processAnalysis(job: AnalyzeWebsiteJobData): Promise<void> {
    const analysis = await this.prisma.websiteAnalysis.findUnique({
      where: { id: job.analysisId },
    });
    if (!analysis) return;

    await this.prisma.websiteAnalysis.update({
      where: { id: analysis.id },
      data: { status: 'RUNNING', startedAt: new Date(), error: null },
    });

    const result = await this.analyzer.analyze(job.url);

    if (result.error && result.issues.some((issue) => issue.code === 'SSRF_BLOCKED')) {
      await this.prisma.websiteAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: 'FAILED',
          error: result.error,
          completedAt: new Date(),
          https: result.https,
        },
      });
      await this.scoring.recalculate(job.leadId);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.websiteAnalysisIssue.deleteMany({ where: { analysisId: analysis.id } });
      await tx.websiteAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: result.accessible || result.httpStatus ? 'COMPLETED' : 'FAILED',
          httpStatus: result.httpStatus ?? null,
          https: result.https ?? null,
          sslValid: result.sslValid ?? null,
          redirectsToHttps: result.redirectsToHttps ?? null,
          responseTimeMs: result.responseTimeMs ?? null,
          title: result.title ?? null,
          metaDescription: result.metaDescription ?? null,
          hasViewport: result.hasViewport ?? null,
          hasContactForm: result.hasContactForm ?? null,
          hasPhone: result.hasPhone ?? null,
          hasEmail: result.hasEmail ?? null,
          hasSocialLinks: result.hasSocialLinks ?? null,
          hasWhatsapp: result.hasWhatsapp ?? null,
          hasPrivacyPolicy: result.hasPrivacyPolicy ?? null,
          hasSitemap: result.hasSitemap ?? null,
          hasRobotsTxt: result.hasRobotsTxt ?? null,
          hasFavicon: result.hasFavicon ?? null,
          hasOpenGraph: result.hasOpenGraph ?? null,
          hasStructuredData: result.hasStructuredData ?? null,
          cms: result.cms ?? null,
          framework: result.framework ?? null,
          analytics: result.analytics ?? null,
          technologies: (result.technologies ?? undefined) as Prisma.InputJsonValue | undefined,
          error: result.error ?? null,
          completedAt: new Date(),
          issues: {
            create: result.issues.map((issue) => ({
              code: issue.code,
              severity: issue.severity,
              message: issue.message,
            })),
          },
        },
      });

      await tx.lead.update({
        where: { id: job.leadId },
        data: {
          websitePresence: result.accessible ? 'WEBSITE_FOUND' : 'NEEDS_REVIEW',
          websiteCheckedAt: new Date(),
          websiteCheckSource: 'ProspectlyAnalyzer',
        },
      });
    });

    await this.scoring.recalculate(job.leadId);
  }

  async onLeadUpsert(organizationId: string, leadId: string, website?: string | null) {
    if (website?.trim()) {
      try {
        await this.enqueueForLead(organizationId, leadId);
      } catch {
        // Soft-fail enqueue during ingestion — scoring still runs for no-site path elsewhere
      }
      return;
    }
    await this.scoring.recalculate(leadId);
  }
}
