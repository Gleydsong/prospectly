import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { DashboardPeriod, QueryDashboardDto } from './dto/query-dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, query: QueryDashboardDto = { period: '30d' }) {
    const baseWhere = this.buildLeadWhere(organizationId, query);
    const periodStart = periodStartDate(query.period);
    const now = new Date();

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
    ] = await this.prisma.$transaction([
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
    ]);

    const closed = won + lost;
    const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;

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
      overdueTasks,
      overdueFollowUps,
      upcomingFollowUps,
      topOpportunities,
      conversionBySource,
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

    const [byStatus, bySegment, byCity, bySource, scoreBuckets] = await Promise.all([
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
    ]);

    return {
      byStatus: byStatus.map((row) => ({ status: row.status, count: row._count })),
      bySegment: bySegment
        .filter((row) => row.segment)
        .map((row) => ({ segment: row.segment, count: row._count })),
      byCity: byCity.map((row) => ({ city: row.city, count: row._count })),
      bySource: bySource.map((row) => ({ source: row.source, count: row._count })),
      byScore: scoreBuckets.map((row) => ({ bucket: row.bucket, count: Number(row.count) })),
    };
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
