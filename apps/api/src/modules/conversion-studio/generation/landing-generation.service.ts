import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConversionGenerationMode,
  ConversionGenerationStatus,
  ConversionPageStatus,
  UsageMeterKey,
  type Prisma,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { EntitlementService } from '../entitlement.service';
import {
  assertPublishableBlocks,
  parsePageBlocks,
  type PageBlock,
} from '../page-blocks.schema';
import {
  GENERATE_LANDING_JOB,
  LANDING_GENERATION_QUEUE,
  LANDING_PROMPT_VERSION,
  REFINE_LANDING_JOB,
  type GenerateLandingJobData,
  type RefineLandingJobData,
} from './landing-generation.constants';
import type { LandingGenerationContext } from './providers/landing-generation.provider';
import { OllamaLandingProvider } from './providers/ollama.provider';
import { TemplateLandingProvider } from './providers/template.provider';
import { applyGoogleMediaToBlocks } from './apply-google-media';
import { blocksToSimpleHtml } from './blocks-to-html';
import { GoogleLinkResolver } from './google-link.resolver';
import { GooglePlaceEnrichmentService } from './google-place-enrichment.service';
import { isAllowedGoogleMapsUrl } from './google-link.parser';
import {
  assertPublishableLandingHtml,
  sanitizeLandingHtml,
} from './html-sanitize';

type GenerateInput = {
  leadId?: string;
  describeText?: string;
  googleLink?: string;
  title?: string;
};

@Injectable()
export class LandingGenerationService {
  private readonly logger = new Logger(LandingGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
    private readonly config: ConfigService,
    private readonly templateProvider: TemplateLandingProvider,
    private readonly ollamaProvider: OllamaLandingProvider,
    private readonly googleLinks: GoogleLinkResolver,
    private readonly placeEnrichment: GooglePlaceEnrichmentService,
    @InjectQueue(LANDING_GENERATION_QUEUE) private readonly queue: Queue,
  ) {}

  async enqueueGenerate(organizationId: string, actorId: string, input: GenerateInput) {
    await this.entitlements.assertCanCreateDraft(organizationId);
    const snapshot = await this.entitlements.getSnapshot(organizationId);
    const preferAi = this.providerName() === 'ollama';
    const hasAiQuota = this.entitlements.canUseAiGeneration(snapshot);

    let mode: GenerateLandingJobData['mode'] = 'TEMPLATE';
    let useAi = false;
    let contextLead: Awaited<ReturnType<LandingGenerationService['loadLead']>> | null = null;
    let resolvedTitle: string | undefined;
    let describeText = input.describeText?.trim();
    const googleLink = input.googleLink?.trim();

    if (input.leadId) {
      contextLead = await this.loadLead(organizationId, input.leadId);
      mode = preferAi && hasAiQuota ? 'AI_LEAD' : 'TEMPLATE';
      useAi = mode === 'AI_LEAD';
      resolvedTitle = contextLead.companyName;
    } else if (describeText) {
      if (describeText.length < 12) {
        throw new BadRequestException('describeText must have at least 12 characters');
      }
      if (!hasAiQuota) {
        await this.entitlements.assertCanUseAiGeneration(organizationId);
      }
      mode = 'AI_DESCRIBE';
      useAi = true;
      resolvedTitle = this.titleFromDescribe(describeText);
    } else if (googleLink) {
      if (!isAllowedGoogleMapsUrl(googleLink)) {
        throw new BadRequestException('googleLink must be a valid Google Maps URL');
      }
      const resolved = await this.googleLinks.resolve(organizationId, googleLink);
      if (resolved.matchedLeadId) {
        contextLead = await this.loadLead(organizationId, resolved.matchedLeadId);
        mode = preferAi && hasAiQuota ? 'AI_GOOGLE' : 'TEMPLATE';
        useAi = mode === 'AI_GOOGLE';
        resolvedTitle = contextLead.companyName;
      } else {
        if (!hasAiQuota && preferAi) {
          await this.entitlements.assertCanUseAiGeneration(organizationId);
        }
        mode = preferAi && hasAiQuota ? 'AI_GOOGLE' : 'TEMPLATE';
        useAi = mode === 'AI_GOOGLE';
        resolvedTitle = resolved.context.companyName;
        describeText = resolved.context.describeText ?? describeText;
        // Stash resolved fields into generationInput via describe/context later in worker
      }
    } else {
      throw new BadRequestException('leadId, describeText or googleLink is required');
    }

    const title = input.title?.trim() || resolvedTitle || 'Landing';
    const draftLimit = (await this.entitlements.getSnapshot(organizationId)).limits.pageDrafts;

    const page = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
      const draftCount = await tx.conversionPage.count({
        where: {
          organizationId,
          status: { in: [ConversionPageStatus.DRAFT, ConversionPageStatus.PREVIEW] },
          deletedAt: null,
        },
      });
      if (draftCount >= draftLimit) {
        throw new ForbiddenException({
          code: 'ENTITLEMENT_PAGE_DRAFTS',
          message: 'Draft page limit reached for current plan',
          requiredPlan: 'STARTER_MONTHLY',
          usage: draftCount,
          limit: draftLimit,
        });
      }

      return tx.conversionPage.create({
        data: {
          organizationId,
          leadId: contextLead?.id,
          title,
          status: 'DRAFT',
          publicSlug: this.createPublicSlug(),
          draftBlocks: [] as unknown as Prisma.InputJsonValue,
          generationStatus: ConversionGenerationStatus.QUEUED,
          generationMode: mode as ConversionGenerationMode,
          generationStartedAt: new Date(),
          generationPromptVersion: LANDING_PROMPT_VERSION,
          generationInput: {
            leadId: contextLead?.id ?? input.leadId ?? null,
            describeText: describeText?.slice(0, 1500) ?? null,
            googleLink: googleLink ?? null,
            resolvedCompanyName: resolvedTitle ?? null,
          } as Prisma.InputJsonValue,
          createdById: actorId,
          updatedById: actorId,
        },
      });
    });

    await this.entitlements.recordUsage(
      organizationId,
      UsageMeterKey.PAGE_DRAFTS,
      `draft:${page.id}`,
    );

    const correlationId = randomUUID();
    await this.queue.add(
      GENERATE_LANDING_JOB,
      {
        organizationId,
        pageId: page.id,
        actorId,
        correlationId,
        mode,
        useAi,
        describeText,
        googleLink,
      } satisfies GenerateLandingJobData,
      {
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    return page;
  }

  async enqueueRefine(organizationId: string, pageId: string, actorId: string, instruction: string) {
    const trimmed = instruction.trim();
    if (trimmed.length < 3 || trimmed.length > 1000) {
      throw new BadRequestException('Instruction must be between 3 and 1000 characters');
    }
    await this.entitlements.assertCanUseAiGeneration(organizationId);

    const page = await this.requirePage(organizationId, pageId);
    const claimed = await this.prisma.conversionPage.updateMany({
      where: {
        id: page.id,
        organizationId,
        generationStatus: {
          notIn: [ConversionGenerationStatus.QUEUED, ConversionGenerationStatus.RUNNING],
        },
      },
      data: {
        generationStatus: ConversionGenerationStatus.QUEUED,
        generationMode: ConversionGenerationMode.AI_REFINE,
        generationError: null,
        generationStartedAt: new Date(),
        generationFinishedAt: null,
        updatedById: actorId,
      },
    });
    if (claimed.count === 0) {
      throw new ConflictException('Generation already in progress');
    }

    await this.queue.add(
      REFINE_LANDING_JOB,
      {
        organizationId,
        pageId: page.id,
        actorId,
        correlationId: randomUUID(),
        instruction: trimmed,
      } satisfies RefineLandingJobData,
      { attempts: 2, removeOnComplete: 100, removeOnFail: 50 },
    );

    return this.prisma.conversionPage.findFirstOrThrow({ where: { id: page.id } });
  }

  async processGenerate(job: GenerateLandingJobData): Promise<void> {
    const claimed = await this.prisma.conversionPage.updateMany({
      where: {
        id: job.pageId,
        organizationId: job.organizationId,
        deletedAt: null,
        generationStatus: {
          in: [ConversionGenerationStatus.QUEUED, ConversionGenerationStatus.RUNNING],
        },
      },
      data: {
        generationStatus: ConversionGenerationStatus.RUNNING,
        generationError: null,
      },
    });
    if (claimed.count === 0) {
      this.logger.warn({
        message: 'Skipping generate job; page not awaiting generation',
        pageId: job.pageId,
      });
      return;
    }

    const page = await this.requirePage(job.organizationId, job.pageId);
    const startedRevision = page.draftRevision;

    const lead = page.leadId ? await this.loadLead(job.organizationId, page.leadId) : null;
    let context = this.toContext(lead, job.describeText);

    if (job.googleLink) {
      try {
        const resolved = await this.googleLinks.resolve(job.organizationId, job.googleLink);
        context = {
          ...context,
          ...resolved.context,
          describeText: job.describeText ?? resolved.context.describeText ?? context.describeText,
          googlePlaceId: resolved.parsed.placeId ?? context.googlePlaceId,
          externalId: resolved.parsed.placeId
            ? `places/${resolved.parsed.placeId}`
            : context.externalId,
        };
        if (resolved.matchedLeadId && !page.leadId) {
          await this.prisma.conversionPage.update({
            where: { id: page.id },
            data: { leadId: resolved.matchedLeadId },
          });
        }
      } catch (error) {
        this.logger.warn({
          message: 'Failed to resolve Google link during generation',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    context = await this.placeEnrichment.enrichContext(context);
    this.logger.log({
      message: 'Landing generation context enriched',
      pageId: page.id,
      enrichment: context.googleEnrichmentStatus,
      photoCount: context.photos?.length ?? 0,
    });

    try {
      const result =
        job.useAi && this.providerName() === 'ollama'
          ? await this.ollamaProvider.generate(context)
          : await this.templateProvider.generate(context);

      const blocks = applyGoogleMediaToBlocks(result.blocks, context);
      const html =
        result.html?.trim() ||
        blocksToSimpleHtml({
          title: result.title,
          companyName: context.companyName,
          blocks,
        });

      const mode: ConversionGenerationMode =
        job.mode === 'TEMPLATE'
          ? ConversionGenerationMode.TEMPLATE
          : (job.mode as ConversionGenerationMode);

      if (job.useAi && result.usedAi) {
        await this.entitlements.recordUsage(
          job.organizationId,
          UsageMeterKey.AI_GENERATIONS,
          `ai-gen:${page.id}`,
        );
      }

      await this.persistSuccess(
        page.id,
        job.actorId,
        result.title,
        blocks,
        html,
        mode,
        undefined,
        startedRevision,
      );
    } catch (error) {
      this.logger.warn({
        message: 'AI generate failed; applying template fallback',
        pageId: page.id,
        error: error instanceof Error ? error.message : String(error),
      });
      const fallback = await this.templateProvider.generate(context);
      const blocks = applyGoogleMediaToBlocks(fallback.blocks, context);
      await this.persistSuccess(
        page.id,
        job.actorId,
        fallback.title,
        blocks,
        fallback.html ||
          blocksToSimpleHtml({
            title: fallback.title,
            companyName: context.companyName,
            blocks,
          }),
        ConversionGenerationMode.TEMPLATE_FALLBACK,
        error instanceof Error ? error.message.slice(0, 300) : 'AI failed',
        startedRevision,
      );
    }
  }

  async processRefine(job: RefineLandingJobData): Promise<void> {
    const claimed = await this.prisma.conversionPage.updateMany({
      where: {
        id: job.pageId,
        organizationId: job.organizationId,
        deletedAt: null,
        generationStatus: {
          in: [ConversionGenerationStatus.QUEUED, ConversionGenerationStatus.RUNNING],
        },
      },
      data: {
        generationStatus: ConversionGenerationStatus.RUNNING,
        generationError: null,
      },
    });
    if (claimed.count === 0) {
      this.logger.warn({
        message: 'Skipping refine job; page not awaiting generation',
        pageId: job.pageId,
      });
      return;
    }

    const page = await this.requirePage(job.organizationId, job.pageId);
    const startedRevision = page.draftRevision;

    const lead = page.leadId ? await this.loadLead(job.organizationId, page.leadId) : null;
    const context = await this.placeEnrichment.enrichContext(this.toContext(lead));
    const currentBlocks = parsePageBlocks(page.draftBlocks);

    try {
      if (this.providerName() !== 'ollama') {
        throw new Error('Ollama provider is required for refine');
      }
      const result = await this.ollamaProvider.refine!({
        ...context,
        currentBlocks,
        currentHtml: page.draftHtml,
        currentTitle: page.title,
        instruction: job.instruction,
      });
      await this.entitlements.recordUsage(
        job.organizationId,
        UsageMeterKey.AI_GENERATIONS,
        // Stable key so BullMQ retries do not double-charge (also fixed in PR #30).
        `ai-refine:${page.id}:${job.correlationId}`,
      );
      const blocks = applyGoogleMediaToBlocks(result.blocks, context);
      await this.persistSuccess(
        page.id,
        job.actorId,
        result.title || page.title,
        blocks,
        result.html,
        ConversionGenerationMode.AI_REFINE,
        undefined,
        startedRevision,
      );
    } catch (error) {
      await this.prisma.conversionPage.updateMany({
        where: {
          id: page.id,
          generationStatus: ConversionGenerationStatus.RUNNING,
        },
        data: {
          generationStatus: ConversionGenerationStatus.FAILED,
          generationError:
            error instanceof Error ? error.message.slice(0, 300) : 'Refine failed',
          generationFinishedAt: new Date(),
          updatedById: job.actorId,
        },
      });
      throw error;
    }
  }

  private async persistSuccess(
    pageId: string,
    actorId: string,
    title: string,
    blocks: PageBlock[],
    html: string,
    mode: ConversionGenerationMode,
    softError?: string,
    expectedDraftRevision?: number,
  ) {
    assertPublishableBlocks(blocks);
    const sanitized = sanitizeLandingHtml(html);
    assertPublishableLandingHtml(sanitized, title);

    // Conditional write: skip if the user edited the draft (revision moved) or
    // another generation job already finished — avoids silent data loss.
    const updated = await this.prisma.conversionPage.updateMany({
      where: {
        id: pageId,
        generationStatus: {
          in: [ConversionGenerationStatus.QUEUED, ConversionGenerationStatus.RUNNING],
        },
        ...(expectedDraftRevision != null ? { draftRevision: expectedDraftRevision } : {}),
      },
      data: {
        title,
        draftBlocks: blocks as unknown as Prisma.InputJsonValue,
        draftHtml: sanitized,
        draftRevision: { increment: 1 },
        generationStatus: ConversionGenerationStatus.SUCCEEDED,
        generationMode: mode,
        generationError: softError ?? null,
        generationFinishedAt: new Date(),
        updatedById: actorId,
      },
    });

    if (updated.count === 0) {
      this.logger.warn({
        message: 'Skipped stale landing generation write (draft changed or job superseded)',
        pageId,
        expectedDraftRevision,
      });
    }
  }

  private providerName(): 'ollama' | 'template' {
    const value = (this.config.get<string>('landingAi.provider') ?? 'ollama').toLowerCase();
    return value === 'template' ? 'template' : 'ollama';
  }

  private toContext(
    lead: Awaited<ReturnType<LandingGenerationService['loadLead']>> | null,
    describeText?: string,
  ): LandingGenerationContext {
    if (lead) {
      return {
        companyName: lead.companyName,
        tradeName: lead.tradeName,
        category: lead.category,
        segment: lead.segment,
        description: lead.description,
        city: lead.city,
        state: lead.state,
        address: lead.address,
        phone: lead.phone ?? lead.whatsapp,
        email: lead.email,
        website: lead.website,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
        externalId: lead.externalId,
        googlePlaceId: lead.externalId,
        describeText,
      };
    }
    return {
      companyName: this.titleFromDescribe(describeText) || 'Negócio local',
      describeText,
    };
  }

  private titleFromDescribe(describeText?: string | null): string {
    if (!describeText?.trim()) return 'Nova landing';
    const firstLine = describeText.trim().split(/\n/)[0] ?? 'Nova landing';
    return firstLine.slice(0, 80);
  }

  private async loadLead(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
    });
    if (!lead) throw new BadRequestException('Lead not found in organization');
    return lead;
  }

  private async requirePage(organizationId: string, id: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  private createPublicSlug(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16);
  }
}
