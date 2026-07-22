import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getBoard(organizationId: string, pipelineId?: string) {
    const pipeline = pipelineId
      ? await this.prisma.pipeline.findFirst({ where: { id: pipelineId, organizationId } })
      : await this.prisma.pipeline.findFirst({ where: { organizationId, isDefault: true } });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    const stages = await this.prisma.pipelineStage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: 'asc' },
      include: {
        leads: {
          where: { deletedAt: null },
          include: { owner: { select: { id: true, name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        },
      },
    });

    return { pipeline, stages };
  }

  async moveLeadToStage(organizationId: string, leadId: string, stageId: string, actorId: string) {
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

    const [updated] = await this.prisma.$transaction([
      this.prisma.lead.update({
        where: { id: leadId },
        data: { stageId },
        include: { stage: true, owner: { select: { id: true, name: true } } },
      }),
      this.prisma.leadActivity.create({
        data: {
          organizationId,
          leadId,
          userId: actorId,
          type: 'STAGE_CHANGED',
          description: `Movido de "${lead.stage?.name ?? 'sem etapa'}" para "${stage.name}"`,
          metadata: { fromStageId: lead.stageId, toStageId: stageId },
        },
      }),
    ]);

    return updated;
  }
}
