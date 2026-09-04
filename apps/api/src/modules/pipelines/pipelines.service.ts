import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';

const leadBoardInclude = {
  owner: { select: { id: true, name: true } },
} as const;

@Injectable()
export class PipelinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: { _count: { select: { leads: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getBoard(
    organizationId: string,
    options: { pipelineId?: string; limit?: number; offset?: number } = {},
  ) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const pipeline = options.pipelineId
      ? await this.prisma.pipeline.findFirst({ where: { id: options.pipelineId, organizationId } })
      : await this.prisma.pipeline.findFirst({ where: { organizationId, isDefault: true } });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    const stages = await this.prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: 'asc' },
    });

    const stagePages = await Promise.all(
      stages.map(async (stage) => {
        const where = { organizationId, stageId: stage.id, deletedAt: null };
        const [totalCount, leads] = await Promise.all([
          this.prisma.lead.count({ where }),
          this.prisma.lead.findMany({
            where,
            include: leadBoardInclude,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
          }),
        ]);

        return {
          ...stage,
          leads,
          totalCount,
          hasMore: offset + leads.length < totalCount,
        };
      }),
    );

    return { pipeline, stages: stagePages, limit, offset };
  }

  async listStageLeads(
    organizationId: string,
    stageId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { organizationId } },
    });
    if (!stage) {
      throw new NotFoundException('Stage not found');
    }

    const where = { organizationId, stageId, deletedAt: null };
    const [totalCount, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: leadBoardInclude,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      stage,
      leads,
      totalCount,
      hasMore: offset + leads.length < totalCount,
      limit,
      offset,
    };
  }

  async moveLeadToStage(
    organizationId: string,
    leadId: string,
    stageId: string,
    actorId: string,
    correlationId?: string,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      include: { stage: { select: { id: true, name: true } } },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    const stage = await this.prisma.pipelineStage.findFirst({
      where: { id: stageId, pipeline: { organizationId } },
    });
    if (!stage) {
      throw new BadRequestException('Stage does not belong to this organization');
    }

    if (lead.stageId === stageId) {
      return lead;
    }

    const [updated, outboxEvent] = await this.prisma.$transaction(async (tx) => {
      const moved = await tx.lead.update({
        where: { id: leadId },
        data: { stageId },
        include: { stage: true, owner: { select: { id: true, name: true } } },
      });
      await tx.leadActivity.create({
        data: {
          organizationId,
          leadId,
          userId: actorId,
          type: 'STAGE_CHANGED',
          description: `Movido de "${lead.stage?.name ?? 'sem etapa'}" para "${stage.name}"`,
          metadata: { fromStageId: lead.stageId, toStageId: stageId },
        },
      });
      const event = await this.outbox.appendLeadStageChanged(tx, {
        organizationId,
        leadId,
        actorId,
        correlationId,
        payload: {
          leadId,
          fromStageId: lead.stageId,
          toStageId: stageId,
          fromStageName: lead.stage?.name ?? null,
          toStageName: stage.name,
        },
      });
      return [moved, event] as const;
    });

    await this.audit.log({
      organizationId,
      userId: actorId,
      action: AUDIT_ACTIONS.LEAD_STAGE_CHANGED,
      entity: 'Lead',
      entityId: leadId,
      metadata: { fromStageId: lead.stageId, toStageId: stageId },
    });

    try {
      await this.outbox.dispatch(outboxEvent);
    } catch {
      // Redis down: reconciler republishes from the persisted PENDING row.
    }

    return updated;
  }
}
