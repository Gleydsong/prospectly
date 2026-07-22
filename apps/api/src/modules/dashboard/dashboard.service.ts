import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string) {
    const baseWhere: Prisma.LeadWhereInput = { organizationId, deletedAt: null };
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [
      totalLeads,
      newLeads,
      qualified,
      contacted,
      meetings,
      proposals,
      won,
      overdueTasks,
      upcomingFollowUps,
      topOpportunities,
    ] = await this.prisma.$transaction([
      this.prisma.lead.count({ where: baseWhere }),
      this.prisma.lead.count({ where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'QUALIFIED' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'CONTACTED' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'MEETING_SCHEDULED' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'PROPOSAL_SENT' } }),
      this.prisma.lead.count({ where: { ...baseWhere, status: 'WON' } }),
      this.prisma.task.count({
        where: { organizationId, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { lt: new Date() } },
      }),
      this.prisma.lead.findMany({
        where: { ...baseWhere, nextContactAt: { gte: new Date() } },
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
    ]);

    const closed = won + (await this.prisma.lead.count({ where: { ...baseWhere, status: 'LOST' } }));
    const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;

    return {
      totalLeads,
      newLeads,
      qualified,
      contacted,
      meetings,
      proposals,
      won,
      conversionRate,
      overdueTasks,
      upcomingFollowUps,
      topOpportunities,
    };
  }

  async charts(organizationId: string) {
    const baseWhere: Prisma.LeadWhereInput = { organizationId, deletedAt: null };

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
        WHERE "organizationId" = ${organizationId} AND "deletedAt" IS NULL
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
}
