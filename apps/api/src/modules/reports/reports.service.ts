import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { LEAD_CREATED_TYPE, LEAD_STAGE_CHANGED_TYPE } from '../outbox/outbox.constants';
import {
  REPORT_BUCKETS,
  REPORT_PERIODS,
  type QueryFunnelConversionDto,
  type ReportBucket,
  type ReportPeriod,
} from './dto/query-funnel-conversion.dto';
import type { QueryFunnelConversionLeadsDto } from './dto/query-funnel-conversion-leads.dto';

export type FunnelConversionSourceRow = {
  source: string;
  inflow: number;
  wins: number;
  losses: number;
  winRate: number;
};

export type FunnelConversionResult = {
  period: ReportPeriod;
  periodStart: string;
  inflow: number;
  wins: number;
  losses: number;
  winRate: number;
  bySource: FunnelConversionSourceRow[];
};

export type FunnelConversionLeadsResult = {
  bucket: ReportBucket;
  period: ReportPeriod;
  ids: string[];
  total: number;
};

type CollectedBuckets = {
  periodStart: Date;
  inflowIds: Set<string>;
  winIds: Set<string>;
  lossIds: Set<string>;
  bySource: Map<string, SourceBucket>;
};

type SourceBucket = {
  inflow: Set<string>;
  wins: Set<string>;
  losses: Set<string>;
};

function isReportPeriod(value: string): value is ReportPeriod {
  return (REPORT_PERIODS as readonly string[]).includes(value);
}

function isReportBucket(value: string | undefined): value is ReportBucket {
  return typeof value === 'string' && (REPORT_BUCKETS as readonly string[]).includes(value);
}

function periodStartDate(period: ReportPeriod, now: Date): Date {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function roundRate(wins: number, union: number): number {
  if (union === 0) return 0;
  return Math.round((wins / union) * 1000) / 10;
}

function payloadString(payload: unknown, key: string): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : null;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async funnelConversion(
    organizationId: string,
    query: QueryFunnelConversionDto,
  ): Promise<FunnelConversionResult> {
    const collected = await this.collectBuckets(organizationId, query);
    const union = new Set([...collected.winIds, ...collected.lossIds]);

    return {
      period: query.period,
      periodStart: collected.periodStart.toISOString(),
      inflow: collected.inflowIds.size,
      wins: collected.winIds.size,
      losses: collected.lossIds.size,
      winRate: roundRate(collected.winIds.size, union.size),
      bySource: [...collected.bySource.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([source, bucket]) => {
          const sourceUnion = new Set([...bucket.wins, ...bucket.losses]);
          return {
            source,
            inflow: bucket.inflow.size,
            wins: bucket.wins.size,
            losses: bucket.losses.size,
            winRate: roundRate(bucket.wins.size, sourceUnion.size),
          };
        }),
    };
  }

  async funnelConversionLeads(
    organizationId: string,
    query: QueryFunnelConversionLeadsDto,
  ): Promise<FunnelConversionLeadsResult> {
    if (!isReportBucket(query.bucket)) {
      throw new BadRequestException('Bucket must be inflow, wins or losses');
    }
    const collected = await this.collectBuckets(organizationId, query);
    const set =
      query.bucket === 'inflow'
        ? collected.inflowIds
        : query.bucket === 'wins'
          ? collected.winIds
          : collected.lossIds;
    const ids = [...set].sort();
    return {
      bucket: query.bucket,
      period: query.period,
      ids,
      total: ids.length,
    };
  }

  private async collectBuckets(
    organizationId: string,
    query: QueryFunnelConversionDto,
  ): Promise<CollectedBuckets> {
    if (!isReportPeriod(query.period)) {
      throw new BadRequestException('Period must be 7d, 30d or 90d');
    }

    const now = new Date();
    const periodStart = periodStartDate(query.period, now);

    const [stages, events] = await Promise.all([
      this.prisma.pipelineStage.findMany({
        where: {
          pipeline: { organizationId },
          OR: [{ isWon: true }, { isLost: true }],
        },
        select: { id: true, isWon: true, isLost: true },
      }),
      this.prisma.outboxEvent.findMany({
        where: {
          organizationId,
          createdAt: { gte: periodStart },
          retainUntil: { gte: now },
          type: { in: [LEAD_CREATED_TYPE, LEAD_STAGE_CHANGED_TYPE] },
        },
        select: { type: true, payload: true, createdAt: true, retainUntil: true },
      }),
    ]);
    const inWindow = events.filter((event) => {
      if (new Date(event.createdAt).getTime() < periodStart.getTime()) return false;
      if (new Date(event.retainUntil).getTime() < now.getTime()) return false;
      return true;
    });

    const wonStageIds = new Set(stages.filter((stage) => stage.isWon).map((stage) => stage.id));
    const lostStageIds = new Set(stages.filter((stage) => stage.isLost).map((stage) => stage.id));

    const leadIds = [
      ...new Set(
        inWindow
          .map((event) => payloadString(event.payload, 'leadId'))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const leads = leadIds.length
      ? await this.prisma.lead.findMany({
          where: { organizationId, id: { in: leadIds }, deletedAt: null },
          select: { id: true, source: true, ownerId: true },
        })
      : [];
    const leadById = new Map(leads.map((lead) => [lead.id, lead]));

    const inflowIds = new Set<string>();
    const winIds = new Set<string>();
    const lossIds = new Set<string>();
    const bySource = new Map<string, SourceBucket>();

    const sourceBucket = (source: string): SourceBucket => {
      const existing = bySource.get(source);
      if (existing) return existing;
      const created: SourceBucket = {
        inflow: new Set(),
        wins: new Set(),
        losses: new Set(),
      };
      bySource.set(source, created);
      return created;
    };

    for (const event of inWindow) {
      const leadId = payloadString(event.payload, 'leadId');
      if (!leadId) continue;
      const lead = leadById.get(leadId);
      if (!lead) continue;
      if (query.source && lead.source !== query.source) continue;
      if (query.ownerId && lead.ownerId !== query.ownerId) continue;

      if (event.type === LEAD_CREATED_TYPE) {
        inflowIds.add(leadId);
        sourceBucket(lead.source).inflow.add(leadId);
      }
      if (event.type === LEAD_STAGE_CHANGED_TYPE) {
        const toStageId = payloadString(event.payload, 'toStageId');
        if (!toStageId) continue;
        if (wonStageIds.has(toStageId)) {
          winIds.add(leadId);
          sourceBucket(lead.source).wins.add(leadId);
        }
        if (lostStageIds.has(toStageId)) {
          lossIds.add(leadId);
          sourceBucket(lead.source).losses.add(leadId);
        }
      }
    }

    return { periodStart, inflowIds, winIds, lossIds, bySource };
  }
}
