import { ForbiddenException, Injectable } from '@nestjs/common';
import { CreditPurchaseStatus, OrgPlan, UsageMeterKey } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { hasUnlimitedAccess } from './domain/plan-access';

export type FeatureKey =
  | 'searches'
  | 'csv_export'
  | 'advanced_geo_search'
  | 'team_members'
  | 'white_label';

interface PlanEntitlements {
  searches: number | null;
  csvExport: boolean;
  advancedGeoSearch: boolean;
  teamMembers: number;
  whiteLabel: boolean;
}

const PLAN_ENTITLEMENTS: Record<OrgPlan, PlanEntitlements> = {
  FREE: {
    searches: 3,
    csvExport: false,
    advancedGeoSearch: true,
    teamMembers: 2,
    whiteLabel: false,
  },
  STARTER_MONTHLY: {
    searches: null,
    csvExport: true,
    advancedGeoSearch: true,
    teamMembers: 10,
    whiteLabel: false,
  },
  LIFETIME: {
    searches: null,
    csvExport: true,
    advancedGeoSearch: true,
    teamMembers: 25,
    whiteLabel: true,
  },
};

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        plan: true,
        planStatus: true,
        currentPeriodEnd: true,
        asaasSubscriptionId: true,
      },
    });
    const plan = hasUnlimitedAccess(org) ? org.plan : OrgPlan.FREE;
    const limits = PLAN_ENTITLEMENTS[plan];
    const members = await this.prisma.organizationMember.count({ where: { organizationId } });

    return {
      plan,
      planStatus: org.planStatus,
      currentPeriodEnd: org.currentPeriodEnd,
      limits,
      usage: {
        teamMembers: members,
      },
      features: this.featureMap(limits),
    };
  }

  async canExportCsv(organizationId: string): Promise<boolean> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        plan: true,
        planStatus: true,
        currentPeriodEnd: true,
        asaasSubscriptionId: true,
      },
    });
    if (hasUnlimitedAccess(org)) {
      return true;
    }
    const purchased = await this.prisma.creditPurchase.count({
      where: { organizationId, status: CreditPurchaseStatus.COMPLETED },
    });
    return purchased > 0;
  }

  async assertTeamSeat(organizationId: string): Promise<void> {
    const snapshot = await this.getSnapshot(organizationId);
    if (snapshot.usage.teamMembers >= snapshot.limits.teamMembers) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_TEAM_MEMBERS',
        message: `Team member limit of ${snapshot.limits.teamMembers} reached`,
        requiredPlan: snapshot.plan === OrgPlan.FREE ? 'STARTER_MONTHLY' : 'LIFETIME',
      });
    }
  }

  async assertFeature(organizationId: string, feature: FeatureKey): Promise<void> {
    if (feature === 'csv_export') {
      if (!(await this.canExportCsv(organizationId))) {
        throw new ForbiddenException({
          code: 'ENTITLEMENT_CSV_EXPORT',
          message: 'Feature csv_export is not available on current plan',
          requiredPlan: 'STARTER_MONTHLY',
        });
      }
      return;
    }

    const snapshot = await this.getSnapshot(organizationId);
    const value = snapshot.features[feature];
    const allowed = typeof value === 'boolean' ? value : Number(value) > 0;
    if (!allowed) {
      throw new ForbiddenException({
        code: `ENTITLEMENT_${feature.toUpperCase()}`,
        message: `Feature ${feature} is not available on current plan`,
        requiredPlan: feature === 'white_label' ? 'LIFETIME' : 'STARTER_MONTHLY',
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
      csv_export: limits.csvExport,
      advanced_geo_search: limits.advancedGeoSearch,
      team_members: limits.teamMembers,
      white_label: limits.whiteLabel,
    };
  }
}
