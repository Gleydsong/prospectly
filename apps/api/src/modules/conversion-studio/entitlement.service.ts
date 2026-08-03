import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgPlan, PlanStatus, UsageMeterKey } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export type FeatureKey =
  | 'searches'
  | 'published_pages'
  | 'page_drafts'
  | 'version_history'
  | 'csv_export'
  | 'advanced_geo_search'
  | 'custom_domain'
  | 'remove_prospectly_brand'
  | 'analytics_pixel'
  | 'team_members'
  | 'ai_generations'
  | 'white_label';

interface PlanEntitlements {
  publishedPages: number;
  pageDrafts: number;
  versionHistory: number;
  searches: number | null;
  csvExport: boolean;
  advancedGeoSearch: boolean;
  customDomain: boolean;
  removeProspectlyBrand: boolean;
  analyticsPixel: boolean;
  teamMembers: number;
  aiGenerations: number;
  whiteLabel: boolean;
}

const PLAN_ENTITLEMENTS: Record<OrgPlan, PlanEntitlements> = {
  FREE: {
    publishedPages: 1,
    pageDrafts: 5,
    versionHistory: 5,
    searches: 3,
    csvExport: false,
    advancedGeoSearch: true,
    customDomain: false,
    removeProspectlyBrand: false,
    analyticsPixel: false,
    teamMembers: 2,
    aiGenerations: 0,
    whiteLabel: false,
  },
  STARTER_MONTHLY: {
    publishedPages: 20,
    pageDrafts: 100,
    versionHistory: 50,
    searches: null,
    csvExport: true,
    advancedGeoSearch: true,
    customDomain: false,
    removeProspectlyBrand: false,
    analyticsPixel: true,
    teamMembers: 10,
    aiGenerations: 0,
    whiteLabel: false,
  },
  LIFETIME: {
    publishedPages: 100,
    pageDrafts: 500,
    versionHistory: 100,
    searches: null,
    csvExport: true,
    advancedGeoSearch: true,
    customDomain: true,
    removeProspectlyBrand: true,
    analyticsPixel: true,
    teamMembers: 25,
    aiGenerations: 0,
    whiteLabel: true,
  },
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { plan: true, planStatus: true, currentPeriodEnd: true },
    });
    const plan = org.planStatus === PlanStatus.ACTIVE ? org.plan : OrgPlan.FREE;
    const limits = PLAN_ENTITLEMENTS[plan];

    const [publishedPages, pageDrafts, members] = await Promise.all([
      this.prisma.conversionPage.count({
        where: { organizationId, status: 'PUBLISHED', deletedAt: null },
      }),
      this.prisma.conversionPage.count({
        where: {
          organizationId,
          status: { in: ['DRAFT', 'PREVIEW'] },
          deletedAt: null,
        },
      }),
      this.prisma.organizationMember.count({ where: { organizationId } }),
    ]);

    return {
      plan,
      planStatus: org.planStatus,
      currentPeriodEnd: org.currentPeriodEnd,
      limits,
      usage: {
        publishedPages,
        pageDrafts,
        teamMembers: members,
      },
      features: this.featureMap(limits),
    };
  }

  async assertCanCreateDraft(organizationId: string): Promise<void> {
    const snapshot = await this.getSnapshot(organizationId);
    if (snapshot.usage.pageDrafts >= snapshot.limits.pageDrafts) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_PAGE_DRAFTS',
        message: 'Draft page limit reached for current plan',
        requiredPlan: 'STARTER_MONTHLY',
        usage: snapshot.usage.pageDrafts,
        limit: snapshot.limits.pageDrafts,
      });
    }
  }

  async assertCanPublish(organizationId: string): Promise<void> {
    const snapshot = await this.getSnapshot(organizationId);
    if (snapshot.usage.publishedPages >= snapshot.limits.publishedPages) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_PUBLISHED_PAGES',
        message: 'Published page limit reached for current plan',
        requiredPlan: 'STARTER_MONTHLY',
        usage: snapshot.usage.publishedPages,
        limit: snapshot.limits.publishedPages,
      });
    }
  }

  async recordUsage(
    organizationId: string,
    meterKey: UsageMeterKey,
    idempotencyKey: string,
    amount = 1,
  ): Promise<void> {
    try {
      await this.prisma.usageLedger.create({
        data: {
          organizationId,
          meterKey,
          amount,
          idempotencyKey,
        },
      });
    } catch (error) {
      // Unique idempotency — treat as success (already metered).
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  private featureMap(limits: PlanEntitlements): Record<FeatureKey, boolean | number> {
    return {
      searches: limits.searches ?? Number.POSITIVE_INFINITY,
      published_pages: limits.publishedPages,
      page_drafts: limits.pageDrafts,
      version_history: limits.versionHistory,
      csv_export: limits.csvExport,
      advanced_geo_search: limits.advancedGeoSearch,
      custom_domain: limits.customDomain,
      remove_prospectly_brand: limits.removeProspectlyBrand,
      analytics_pixel: limits.analyticsPixel,
      team_members: limits.teamMembers,
      ai_generations: limits.aiGenerations,
      white_label: limits.whiteLabel,
    };
  }
}
