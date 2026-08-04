import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConversionEventType,
  ConversionPageStatus,
  type Prisma,
  UsageMeterKey,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateConversionPageDto,
  PublicFormSubmitDto,
  QueryConversionPagesDto,
  TrackPublicEventDto,
  UpdateConversionPageDraftDto,
} from './dto/conversion-page.dto';
import {
  assertPublishableBlocks,
  defaultBlocksFromLead,
  parsePageBlocks,
  type PageBlock,
} from './page-blocks.schema';
import { EntitlementService } from './entitlement.service';
import { blocksToSimpleHtml } from './generation/blocks-to-html';
import {
  assertPublishableLandingHtml,
  sanitizeLandingHtml,
} from './generation/html-sanitize';
import { normalizePublicFormFields } from './normalize-public-form';

@Injectable()
export class ConversionStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async list(
    organizationId: string,
    query: QueryConversionPagesDto,
  ): Promise<PaginatedResult<unknown>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.ConversionPageWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.leadId ? { leadId: query.leadId } : {}),
      ...(query.status ? { status: query.status as ConversionPageStatus } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.conversionPage.count({ where }),
      this.prisma.conversionPage.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          status: true,
          publicSlug: true,
          leadId: true,
          publishedVersion: true,
          draftRevision: true,
          publishedAt: true,
          updatedAt: true,
          createdAt: true,
          draftBlocks: true,
          draftHtml: true,
          generationStatus: true,
          generationMode: true,
          generationError: true,
          lead: { select: { id: true, companyName: true, category: true, city: true } },
        },
      }),
    ]);
    const mapped = rows.map(({ draftHtml, ...rest }) => ({
      ...rest,
      hasHtml: Boolean(draftHtml?.trim()),
    }));
    return paginate(mapped, total, page, pageSize);
  }

  async get(organizationId: string, id: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            category: true,
            city: true,
            phone: true,
            address: true,
          },
        },
        versions: {
          orderBy: { version: 'desc' },
          take: 20,
          select: {
            id: true,
            version: true,
            title: true,
            changeNote: true,
            createdAt: true,
            createdById: true,
          },
        },
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async create(organizationId: string, actorId: string, dto: CreateConversionPageDto) {
    await this.entitlements.assertCanCreateDraft(organizationId);

    let blocks: PageBlock[] = [];
    let title = dto.title.trim();
    let leadId: string | undefined;

    if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, organizationId, deletedAt: null },
      });
      if (!lead) throw new BadRequestException('Lead not found in organization');
      leadId = lead.id;
      if (!title) title = `Proposta — ${lead.companyName}`;
      blocks = defaultBlocksFromLead({
        companyName: lead.companyName,
        category: lead.category,
        city: lead.city,
        phone: lead.phone ?? lead.whatsapp,
        address: lead.address,
      });
    }

    if (!title) throw new BadRequestException('Title is required');

    const draftHtml =
      blocks.length > 0
        ? blocksToSimpleHtml({
            title,
            companyName: title.replace(/^Proposta — /, ''),
            blocks,
          })
        : null;

    const page = await this.prisma.conversionPage.create({
      data: {
        organizationId,
        leadId,
        title,
        status: ConversionPageStatus.DRAFT,
        publicSlug: this.createPublicSlug(),
        draftBlocks: blocks as unknown as Prisma.InputJsonValue,
        draftHtml,
        createdById: actorId,
        updatedById: actorId,
      },
    });

    await this.entitlements.recordUsage(organizationId, UsageMeterKey.PAGE_DRAFTS, `draft:${page.id}`);
    return page;
  }

  async updateDraft(
    organizationId: string,
    id: string,
    actorId: string,
    dto: UpdateConversionPageDraftDto,
  ) {
    const page = await this.requirePage(organizationId, id);
    if (page.status === ConversionPageStatus.ARCHIVED) {
      throw new BadRequestException('Archived pages cannot be edited');
    }
    if (dto.expectedRevision != null && dto.expectedRevision !== page.draftRevision) {
      throw new ConflictException('Draft was modified by another session');
    }

    let blocks: PageBlock[];
    try {
      blocks = parsePageBlocks(dto.blocks);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid page blocks schema',
      );
    }

    const draftHtml = blocksToSimpleHtml({
      title: dto.title?.trim() || page.title,
      companyName: page.title,
      blocks,
    });

    return this.prisma.conversionPage.update({
      where: { id: page.id },
      data: {
        ...(dto.title ? { title: dto.title.trim() } : {}),
        draftBlocks: blocks as unknown as Prisma.InputJsonValue,
        draftHtml,
        draftRevision: { increment: 1 },
        updatedById: actorId,
        status:
          page.status === ConversionPageStatus.PUBLISHED
            ? ConversionPageStatus.PUBLISHED
            : ConversionPageStatus.DRAFT,
      },
    });
  }

  async publish(organizationId: string, id: string, actorId: string) {
    const page = await this.requirePage(organizationId, id);
    if (page.status === ConversionPageStatus.ARCHIVED) {
      throw new BadRequestException('Archived pages cannot be published');
    }

    const hasHtml = Boolean(page.draftHtml?.trim());
    let blocks: PageBlock[] = [];
    let html: string | null = null;

    if (hasHtml) {
      try {
        html = sanitizeLandingHtml(page.draftHtml!);
        assertPublishableLandingHtml(html, page.title);
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid landing HTML',
        );
      }
      try {
        blocks = parsePageBlocks(page.draftBlocks);
      } catch {
        blocks = [];
      }
    } else {
      try {
        blocks = parsePageBlocks(page.draftBlocks);
        assertPublishableBlocks(blocks);
        html = blocksToSimpleHtml({
          title: page.title,
          companyName: page.title,
          blocks,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid page blocks schema',
        );
      }
    }

    const wasPublished = page.status === ConversionPageStatus.PUBLISHED;
    // Pre-check for fast fail; authoritative quota is re-checked under org row lock below.
    if (!wasPublished) {
      await this.entitlements.assertCanPublish(organizationId);
    }

    const nextVersion = (page.publishedVersion ?? 0) + 1;
    const publishLimit = (await this.entitlements.getSnapshot(organizationId)).limits
      .publishedPages;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent first-publishes for this org (quota race).
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;

      if (!wasPublished) {
        const publishedCount = await tx.conversionPage.count({
          where: {
            organizationId,
            status: ConversionPageStatus.PUBLISHED,
            deletedAt: null,
          },
        });
        if (publishedCount >= publishLimit) {
          throw new ForbiddenException({
            code: 'ENTITLEMENT_PUBLISHED_PAGES',
            message: 'Published page limit reached for current plan',
            requiredPlan: 'STARTER_MONTHLY',
            usage: publishedCount,
            limit: publishLimit,
          });
        }
      }

      await tx.conversionPageVersion.create({
        data: {
          pageId: page.id,
          organizationId,
          version: nextVersion,
          title: page.title,
          blocks: blocks as unknown as Prisma.InputJsonValue,
          html,
          createdById: actorId,
          changeNote: wasPublished ? 'New published version' : 'Initial publish',
        },
      });

      const result = await tx.conversionPage.update({
        where: { id: page.id },
        data: {
          status: ConversionPageStatus.PUBLISHED,
          publishedVersion: nextVersion,
          publishedAt: new Date(),
          draftHtml: html,
          updatedById: actorId,
        },
      });

      await tx.conversionEvent.create({
        data: {
          organizationId,
          pageId: page.id,
          version: nextVersion,
          type: ConversionEventType.page_published,
          metadata: { actorId },
        },
      });

      return result;
    });

    if (!wasPublished) {
      await this.entitlements.recordUsage(
        organizationId,
        UsageMeterKey.PUBLISHED_PAGES,
        `publish:${page.id}`,
      );
    }

    return updated;
  }

  async unpublish(organizationId: string, id: string, actorId: string) {
    const page = await this.requirePage(organizationId, id);
    if (page.status !== ConversionPageStatus.PUBLISHED) {
      throw new BadRequestException('Page is not published');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.conversionPage.update({
        where: { id: page.id },
        data: {
          status: ConversionPageStatus.DRAFT,
          updatedById: actorId,
        },
      });
      await tx.conversionEvent.create({
        data: {
          organizationId,
          pageId: page.id,
          version: page.publishedVersion,
          type: ConversionEventType.page_unpublished,
          metadata: { actorId },
        },
      });
      return result;
    });
    return updated;
  }

  async archive(organizationId: string, id: string, actorId: string) {
    const page = await this.requirePage(organizationId, id);
    return this.prisma.conversionPage.update({
      where: { id: page.id },
      data: {
        status: ConversionPageStatus.ARCHIVED,
        archivedAt: new Date(),
        deletedAt: new Date(),
        updatedById: actorId,
      },
    });
  }

  async restoreVersion(organizationId: string, id: string, version: number, actorId: string) {
    const page = await this.requirePage(organizationId, id);
    const snapshot = await this.prisma.conversionPageVersion.findFirst({
      where: { pageId: page.id, organizationId, version },
    });
    if (!snapshot) throw new NotFoundException('Version not found');

    let blocks: PageBlock[];
    try {
      blocks = parsePageBlocks(snapshot.blocks);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Stored version blocks invalid',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.conversionPage.update({
        where: { id: page.id },
        data: {
          title: snapshot.title,
          draftBlocks: blocks as unknown as Prisma.InputJsonValue,
          draftHtml: snapshot.html,
          draftRevision: { increment: 1 },
          updatedById: actorId,
          status:
            page.status === ConversionPageStatus.ARCHIVED
              ? ConversionPageStatus.DRAFT
              : page.status,
        },
      });
      await tx.conversionEvent.create({
        data: {
          organizationId,
          pageId: page.id,
          version,
          type: ConversionEventType.page_version_restored,
          metadata: { actorId, restoredVersion: version },
        },
      });
      return result;
    });
  }

  async metrics(organizationId: string, id: string, days = 30) {
    const page = await this.requirePage(organizationId, id);
    const since = new Date(Date.now() - days * 86_400_000);
    const events = await this.prisma.conversionEvent.groupBy({
      by: ['type'],
      where: {
        organizationId,
        pageId: page.id,
        createdAt: { gte: since },
        type: {
          in: [
            ConversionEventType.page_view,
            ConversionEventType.cta_click,
            ConversionEventType.form_submitted,
          ],
        },
      },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(
      events.map((row) => [row.type, row._count._all]),
    ) as Partial<Record<ConversionEventType, number>>;

    const views = counts.page_view ?? 0;
    const ctaClicks = counts.cta_click ?? 0;
    const formSubmitted = counts.form_submitted ?? 0;
    const conversionRate = views > 0 ? Math.round((formSubmitted / views) * 1000) / 10 : 0;

    const topCta = await this.prisma.conversionEvent.findMany({
      where: {
        organizationId,
        pageId: page.id,
        type: ConversionEventType.cta_click,
        createdAt: { gte: since },
      },
      select: { metadata: true },
      take: 200,
    });
    const ctaFreq = new Map<string, number>();
    for (const event of topCta) {
      const meta = event.metadata as { ctaType?: string } | null;
      const key = meta?.ctaType ?? 'unknown';
      ctaFreq.set(key, (ctaFreq.get(key) ?? 0) + 1);
    }
    const topCtaType =
      [...ctaFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const lastConversion = await this.prisma.conversionFormSubmission.findFirst({
      where: { organizationId, pageId: page.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      pageId: page.id,
      periodDays: days,
      views,
      ctaClicks,
      formSubmitted,
      conversionRate,
      topCtaType,
      lastConversionAt: lastConversion?.createdAt ?? null,
    };
  }

  async getPublicBySlug(publicSlug: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: {
        publicSlug,
        status: ConversionPageStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        publicSlug: true,
        publishedVersion: true,
        organizationId: true,
        analyticsPixelEnabled: true,
        analyticsConsentLabel: true,
      },
    });
    if (!page || page.publishedVersion == null) {
      throw new NotFoundException('Page not found');
    }

    const version = await this.prisma.conversionPageVersion.findFirst({
      where: {
        pageId: page.id,
        organizationId: page.organizationId,
        version: page.publishedVersion,
      },
      select: { title: true, blocks: true, html: true, version: true },
    });
    if (!version) throw new NotFoundException('Page not found');

    const entitlements = await this.entitlements.getSnapshot(page.organizationId);
    const analyticsAllowed = Boolean(entitlements.features.analytics_pixel);

    return {
      title: version.title,
      publicSlug: page.publicSlug,
      version: version.version,
      html: version.html,
      blocks: version.blocks,
      analytics: {
        enabled: analyticsAllowed && page.analyticsPixelEnabled,
        consentLabel:
          page.analyticsConsentLabel ??
          'Aceito o uso de métricas anónimas de visitas nesta página.',
      },
    };
  }

  async trackPublic(publicSlug: string, dto: TrackPublicEventDto) {
    const page = await this.requirePublishedBySlug(publicSlug);
    await this.prisma.conversionEvent.create({
      data: {
        organizationId: page.organizationId,
        pageId: page.id,
        version: page.publishedVersion,
        type: dto.type as ConversionEventType,
        channel: dto.channel,
        metadata: dto.ctaType ? { ctaType: dto.ctaType } : undefined,
      },
    });
    return { ok: true };
  }

  async submitPublicForm(publicSlug: string, dto: PublicFormSubmitDto) {
    const normalized = normalizePublicFormFields(dto as unknown as Record<string, unknown>);
    if (normalized.companyWebsite) {
      return { ok: true };
    }
    if (!normalized.name && !normalized.email && !normalized.phone && !normalized.message) {
      throw new BadRequestException('Empty form');
    }
    if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) {
      throw new BadRequestException('Invalid email');
    }

    const page = await this.requirePublishedBySlug(publicSlug);
    const payload = {
      ...(normalized.name ? { name: normalized.name.slice(0, 120) } : {}),
      ...(normalized.email ? { email: normalized.email.toLowerCase().slice(0, 254) } : {}),
      ...(normalized.phone ? { phone: normalized.phone.slice(0, 32) } : {}),
      ...(normalized.message ? { message: normalized.message.slice(0, 2000) } : {}),
    };

    const actorId = await this.resolveSystemActorId(page.organizationId, page.createdById);

    await this.prisma.$transaction(async (tx) => {
      await tx.conversionFormSubmission.create({
        data: {
          organizationId: page.organizationId,
          pageId: page.id,
          version: page.publishedVersion,
          payload,
          leadId: page.leadId,
        },
      });
      await tx.conversionEvent.create({
        data: {
          organizationId: page.organizationId,
          pageId: page.id,
          version: page.publishedVersion,
          type: ConversionEventType.form_submitted,
        },
      });
      if (page.leadId && actorId) {
        await tx.leadActivity.create({
          data: {
            organizationId: page.organizationId,
            leadId: page.leadId,
            userId: actorId,
            type: 'NOTE',
            description: 'Conversão registrada via página publicada do Conversion Studio.',
            metadata: {
              source: 'conversion_page_form',
              pageId: page.id,
              version: page.publishedVersion,
              fieldsPresent: Object.keys(payload),
            },
          },
        });
        await tx.lead.update({
          where: { id: page.leadId },
          data: { lastContactAt: new Date() },
        });
      }
    });

    return { ok: true, message: 'Recebemos o seu contacto.' };
  }

  async updateAnalyticsSettings(
    organizationId: string,
    id: string,
    actorId: string,
    input: { analyticsPixelEnabled?: boolean; analyticsConsentLabel?: string },
  ) {
    const page = await this.requirePage(organizationId, id);
    if (input.analyticsPixelEnabled) {
      await this.entitlements.assertFeature(organizationId, 'analytics_pixel');
    }
    return this.prisma.conversionPage.update({
      where: { id: page.id },
      data: {
        ...(input.analyticsPixelEnabled != null
          ? { analyticsPixelEnabled: input.analyticsPixelEnabled }
          : {}),
        ...(input.analyticsConsentLabel !== undefined
          ? { analyticsConsentLabel: input.analyticsConsentLabel?.trim().slice(0, 240) || null }
          : {}),
        updatedById: actorId,
      },
      select: {
        id: true,
        analyticsPixelEnabled: true,
        analyticsConsentLabel: true,
      },
    });
  }

  private async resolveSystemActorId(
    organizationId: string,
    preferredUserId?: string | null,
  ): Promise<string | null> {
    if (preferredUserId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: { organizationId, userId: preferredUserId },
        select: { userId: true },
      });
      if (member) return member.userId;
    }
    const owner = await this.prisma.organizationMember.findFirst({
      where: { organizationId, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });
    return owner?.userId ?? null;
  }

  private async requirePage(organizationId: string, id: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  private async requirePublishedBySlug(publicSlug: string) {
    const page = await this.prisma.conversionPage.findFirst({
      where: {
        publicSlug,
        status: ConversionPageStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        publishedVersion: true,
        leadId: true,
        createdById: true,
      },
    });
    if (!page || page.publishedVersion == null) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private createPublicSlug(): string {
    return randomBytes(12).toString('base64url');
  }
}
