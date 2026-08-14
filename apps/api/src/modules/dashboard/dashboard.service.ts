import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { FREE_SEARCH_LIMIT } from '../billing/billing.constants';
import type { DashboardPeriod, QueryDashboardDto } from './dto/query-dashboard.dto';

export type DashboardRecommendationCode =
  | 'HIGH_POTENTIAL_IDLE'
  | 'STALE_LEADS'
  | 'OVERDUE_FOLLOW_UPS'
  | 'FREE_SEARCH_QUOTA';

export interface DashboardRecommendation {
  code: DashboardRecommendationCode;
  count: number;
  href: string;
  severity: 'info' | 'warning' | 'action';
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, query: QueryDashboardDto = { period: '30d' }) {
    const baseWhere = this.buildLeadWhere(organizationId, query);
    const periodStart = periodStartDate(query.period);
    const now = new Date();
    const staleBefore = new Date(Date.now() - 7 * 86_400_000);
    const activeStatuses = {
      notIn: ['WON', 'LOST', 'ARCHIVED', 'DISQUALIFIED'] as Array<
        'WON' | 'LOST' | 'ARCHIVED' | 'DISQUALIFIED'
      >,
    };

    const [
      totalLeads,
      newLeads,
      qualified,
      contacted,
      meetings,
      proposals,
      won,
      lost,
      overdueTasks,
      overdueFollowUps,
      upcomingFollowUps,
      topOpportunities,
      conversionBySourceRaw,
      approached,
      highPotentialIdle,
      staleLeads,
      searchCount,
      org,
    ] = await Promise.all([
      this.prisma.lead.count({ where: baseWhere }),
      this.prisma.lead.count({
        where: periodStart
          ? { ...baseWhere, createdAt: { gte: periodStart } }
          : {
              ...baseWhere,
              createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
            },
      }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'QUALIFIED' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'CONTACTED' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'MEETING_SCHEDULED' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'PROPOSAL_SENT' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'WON' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'LOST' } }),
      this.prisma.task.count({
        where: {
          organizationId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueAt: { lt: now },
          ...(query.ownerId ? { assigneeId: query.ownerId } : {}),
        },
      }),
      this.prisma.lead.findMany({
        where: {
          ...baseWhere,
          nextContactAt: { lt: now },
          status: { notIn: ['WON', 'LOST', 'ARCHIVED'] },
        },
        select: { id: true, companyName: true, nextContactAt: true },
        orderBy: { nextContactAt: 'asc' },
        take: 10,
      }),
      this.prisma.lead.findMany({
        where: { ...baseWhere, nextContactAt: { gte: now } },
        select: { id: true, companyName: true, nextContactAt: true },
        orderBy: { nextContactAt: 'asc' },
        take: 5,
      }),
      this.prisma.lead.findMany({
        where: { ...baseWhere, status: { notIn: ['WON', 'LOST', 'ARCHIVED'] } },
        select: { id: true, companyName: true, score: true, status: true, city: true },
        orderBy: { score: 'desc' },
        take: 5,
      }),
      this.prisma.lead.groupBy({
        by: ['source', 'status'],
        where: baseWhere,
        _count: { _all: true },
        orderBy: { source: 'asc' },
      }),
      this.prisma.lead.count({
        where: {
          ...baseWhere,
          status: {
            in: [
              'CONTACTED',
              'RESPONDED',
              'MEETING_SCHEDULED',
              'PROPOSAL_SENT',
              'NEGOTIATION',
              'WON',
              'LOST',
            ],
          },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...baseWhere,
          score: { gte: 70 },
          status: { in: ['NEW', 'TO_REVIEW', 'QUALIFIED'] },
        },
      }),
      this.prisma.lead.count({
        where: {
          ...baseWhere,
          status: activeStatuses,
          updatedAt: { lt: staleBefore },
        },
      }),
      this.prisma.search.count({ where: { organizationId } }),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true, planStatus: true },
      }),
    ]);

    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;
    const lossRate = closed > 0 ? Math.round((lost / closed) * 1000) / 10 : 0;
    const approachRate = totalLeads > 0 ? Math.round((approached / totalLeads) * 1000) / 10 : 0;
    const meetingRate = approached > 0 ? Math.round((meetings / approached) * 1000) / 10 : 0;
    const followUpRate =
      totalLeads > 0 ? Math.round((overdueFollowUps.length / totalLeads) * 1000) / 10 : 0;

    const bySource = new Map<string, { source: string; total: number; won: number; lost: number }>();
    for (const row of conversionBySourceRaw) {
      const count = aggregateCount(row._count);
      const entry = bySource.get(row.source) ?? {
        source: row.source,
        total: 0,
        won: 0,
        lost: 0,
      };
      entry.total += count;
      if (row.status === 'WON') entry.won += count;
      if (row.status === 'LOST') entry.lost += count;
      bySource.set(row.source, entry);
    }

    const conversionBySource = [...bySource.values()].map((entry) => {
      const closedForSource = entry.won + entry.lost;
      return {
        source: entry.source,
        total: entry.total,
        won: entry.won,
        lost: entry.lost,
        conversionRate:
          closedForSource > 0 ? Math.round((entry.won / closedForSource) * 1000) / 10 : 0,
      };
    });

    const recommendations = this.buildRecommendations({
      highPotentialIdle,
      staleLeads,
      overdueFollowUps: overdueFollowUps.length,
      searchCount,
      planStatus: org?.planStatus ?? 'INACTIVE',
    });

    return {
      totalLeads,
      newLeads,
      qualified,
      contacted,
      meetings,
      proposals,
      won,
      lost,
      conversionRate,
      lossRate,
      approachRate,
      meetingRate,
      followUpRate,
      rates: {
        /** approached / totalLeads — status in CONTACTED..LOST */
        approachRate,
        /** meetings / approached — MEETING_SCHEDULED / approached */
        meetingRate,
        /** overdueFollowUps (sample size up to 10) / totalLeads — proxy for follow-up pressure */
        followUpRate,
        /** won / (won + lost) */
        conversionRate,
        /** lost / (won + lost) */
        lossRate,
        period: query.period ?? '30d',
      },
      overdueTasks,
      overdueFollowUps,
      upcomingFollowUps,
      topOpportunities,
      conversionBySource,
      recommendations,
      filters: {
        period: query.period ?? '30d',
        source: query.source ?? null,
        ownerId: query.ownerId ?? null,
        segment: query.segment ?? null,
      },
    };
  }

  async charts(organizationId: string, query: QueryDashboardDto = { period: '30d' }) {
    const baseWhere = this.buildLeadWhere(organizationId, query);

    const [byStatus, bySegment, byCity, bySource, scoreBuckets, mapPins] = await Promise.all([
      this.prisma.lead.groupBy({ by: ['status'], where: baseWhere, _count: true }),
      this.prisma.lead.groupBy({ by: ['segment'], where: baseWhere, _count: true }),
      this.prisma.lead.groupBy({
        by: ['city'],
        where: { ...baseWhere, city: { not: null } },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 10,
      }),
      this.prisma.lead.groupBy({ by: ['source'], where: baseWhere, _count: true }),
      this.prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
        SELECT CASE
            WHEN score < 30 THEN '0-29'
            WHEN score < 60 THEN '30-59'
            WHEN score < 80 THEN '60-79'
            ELSE '80-100'
          END AS bucket,
          COUNT(*)::bigint AS count
        FROM "Lead"
        WHERE "organizationId" = ${organizationId}
          AND "deletedAt" IS NULL
          ${query.source ? Prisma.sql`AND "source" = ${query.source}::"LeadSource"` : Prisma.empty}
          ${query.ownerId ? Prisma.sql`AND "ownerId" = ${query.ownerId}` : Prisma.empty}
          ${
            query.segment
              ? Prisma.sql`AND LOWER("segment") = LOWER(${query.segment})`
              : Prisma.empty
          }
          ${
            periodStartDate(query.period)
              ? Prisma.sql`AND "createdAt" >= ${periodStartDate(query.period)}`
              : Prisma.empty
          }
        GROUP BY bucket
      `,
      this.prisma.lead.findMany({
        where: {
          ...baseWhere,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          companyName: true,
          city: true,
          latitude: true,
          longitude: true,
          score: true,
          status: true,
        },
        orderBy: { score: 'desc' },
        take: 80,
      }),
    ]);

    return {
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count })),
      bySegment: bySegment
        .filter((row) => row.segment)
        .map((row) => ({ segment: row.segment, count: row._count })),
      byCity: byCity.map((row) => ({ city: row.city, count: row._count })),
      bySource: bySource.map((row) => ({ source: row.source, count: row._count })),
      byScore: scoreBuckets.map((row) => ({ bucket: row.bucket, count: Number(row.count) })),
      mapPins: mapPins
        .filter(
          (pin): pin is typeof pin & { latitude: number; longitude: number } =>
            pin.latitude != null && pin.longitude != null,
        )
        .map((pin) => ({
          id: pin.id,
          companyName: pin.companyName,
          city: pin.city,
          latitude: pin.latitude,
          longitude: pin.longitude,
          score: pin.score,
          status: pin.status,
        })),
    };
  }

  private buildRecommendations(input: {
    highPotentialIdle: number;
    staleLeads: number;
    overdueFollowUps: number;
    searchCount: number;
    planStatus: string;
  }): DashboardRecommendation[] {
    const items: DashboardRecommendation[] = [];

    if (input.highPotentialIdle > 0) {
      items.push({
        code: 'HIGH_POTENTIAL_IDLE',
        count: input.highPotentialIdle,
        href: '/leads?status=QUALIFIED',
        severity: 'action',
      });
    }

    if (input.staleLeads > 0) {
      items.push({
        code: 'STALE_LEADS',
        count: input.staleLeads,
        href: '/pipeline',
        severity: 'warning',
      });
    }

    if (input.overdueFollowUps > 0) {
      items.push({
        code: 'OVERDUE_FOLLOW_UPS',
        count: input.overdueFollowUps,
        href: '/tasks',
        severity: 'warning',
      });
    }

    if (input.planStatus !== 'ACTIVE' && input.searchCount >= FREE_SEARCH_LIMIT - 1) {
      items.push({
        code: 'FREE_SEARCH_QUOTA',
        count: Math.max(0, FREE_SEARCH_LIMIT - input.searchCount),
        href: '/credits',
        severity: input.searchCount >= FREE_SEARCH_LIMIT ? 'warning' : 'info',
      });
    }

    return items;
  }

  private buildLeadWhere(organizationId: string, query: QueryDashboardDto): Prisma.LeadWhereInput {
    const periodStart = periodStartDate(query.period);
    return {
      organizationId,
      deletedAt: null,
      ...(query.source ? { source: query.source } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.segment ? { segment: { equals: query.segment, mode: 'insensitive' } } : {}),
      ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
    };
  }
}

function periodStartDate(period: DashboardPeriod | undefined): Date | null {
  const value = period ?? '30d';
  if (value === 'all') return null;
  const days = value === '7d' ? 7 : value === '90d' ? 90 : 30;
  return new Date(Date.now() - days * 86_400_000);
}

function aggregateCount(count: number | { _all?: number } | true | undefined): number {
  if (typeof count === 'number') return count;
  if (count === true) return 1;
  return count?._all ?? 0;
}
