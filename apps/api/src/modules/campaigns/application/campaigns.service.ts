import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { paginate } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  defaultStages,
  emptyStageMetrics,
  parseCampaignMetrics,
  stageTaskTitle,
  type CampaignMetricsPayload,
  type CampaignStageDefinition,
} from '../domain/campaign-stages';
import { AddCampaignLeadsDto } from '../presentation/dto/add-campaign-leads.dto';
import { CreateCampaignDto } from '../presentation/dto/create-campaign.dto';
import { CreateStageTasksDto } from '../presentation/dto/create-stage-tasks.dto';
import { QueryCampaignsDto } from '../presentation/dto/query-campaigns.dto';
import { TemplatesService } from './templates.service';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
  ) {}

  async list(organizationId: string, query: QueryCampaignsDto) {
    const where: Prisma.CampaignWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        include: {
          template: { select: { id: true, name: true, category: true } },
          owner: { select: { id: true, name: true } },
          _count: { select: { leads: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(data, total, query.page, query.pageSize);
  }

  async get(organizationId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: {
        template: true,
        owner: { select: { id: true, name: true, email: true } },
        leads: {
          take: 50,
          orderBy: { addedAt: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                companyName: true,
                email: true,
                phone: true,
                city: true,
                status: true,
                doNotContact: true,
              },
            },
          },
        },
        _count: { select: { leads: true } },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return {
      ...campaign,
      metrics: parseCampaignMetrics(campaign.metrics),
      assistedOnly: true,
      autoSendEnabled: false,
    };
  }

  async create(organizationId: string, userId: string, dto: CreateCampaignDto) {
    if (dto.templateId) {
      await this.templates.get(organizationId, dto.templateId);
    }
    if (dto.rules?.ownerId) {
      await this.assertMember(organizationId, dto.rules.ownerId);
    }

    const stages = this.buildStages(dto);
    const metrics: CampaignMetricsPayload = {
      stages,
      rules: dto.rules,
    };

    return this.prisma.campaign.create({
      data: {
        organizationId,
        ownerId: dto.rules?.ownerId ?? userId,
        templateId: dto.templateId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        segment: dto.segment?.trim(),
        channel: (dto.channel ?? 'ASSISTED').trim().toUpperCase(),
        status: 'DRAFT',
        metrics: metrics as unknown as Prisma.InputJsonValue,
      },
      include: {
        template: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
    });
  }

  async addLeads(organizationId: string, campaignId: string, dto: AddCampaignLeadsDto) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    const leads = await this.prisma.lead.findMany({
      where: {
        organizationId,
        id: { in: dto.leadIds },
        deletedAt: null,
      },
      select: { id: true, doNotContact: true },
    });
    if (leads.length !== dto.leadIds.length) {
      throw new BadRequestException('One or more leads were not found in this organization');
    }
    const blocked = leads.filter((l) => l.doNotContact);
    if (blocked.length > 0) {
      throw new BadRequestException({
        message: 'Cannot add do-not-contact leads to a campaign',
        leadIds: blocked.map((l) => l.id),
      });
    }

    await this.prisma.campaignLead.createMany({
      data: dto.leadIds.map((leadId) => ({
        campaignId: campaign.id,
        leadId,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });

    return this.get(organizationId, campaignId);
  }

  async createStageTasks(
    organizationId: string,
    userId: string,
    campaignId: string,
    stageId: string,
    dto: CreateStageTasksDto,
  ) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    const metrics = parseCampaignMetrics(campaign.metrics);
    const stage = metrics.stages.find((s) => s.id === stageId);
    if (!stage) {
      throw new NotFoundException('Campaign stage not found');
    }

    if (dto.assigneeId) {
      await this.assertMember(organizationId, dto.assigneeId);
    }

    const leadFilter = dto.leadIds?.length
      ? { leadId: { in: dto.leadIds } }
      : { status: 'PENDING' };

    const campaignLeads = await this.prisma.campaignLead.findMany({
      where: { campaignId, ...leadFilter },
      include: {
        lead: {
          select: {
            id: true,
            companyName: true,
            organizationId: true,
            doNotContact: true,
            deletedAt: true,
          },
        },
      },
    });

    const eligible = campaignLeads.filter(
      (cl) =>
        cl.lead.organizationId === organizationId &&
        !cl.lead.doNotContact &&
        cl.lead.deletedAt == null,
    );

    if (eligible.length === 0) {
      throw new BadRequestException('No eligible campaign leads for task creation');
    }

    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    const assigneeId = dto.assigneeId ?? campaign.ownerId ?? userId;

    const created = await this.prisma.$transaction(
      eligible.map((cl) =>
        this.prisma.task.create({
          data: {
            organizationId,
            createdById: userId,
            assigneeId,
            leadId: cl.leadId,
            title: stageTaskTitle(stage, cl.lead.companyName),
            description: [
              `Campanha: ${campaign.name}`,
              `Etapa: ${stage.name} (${stage.type})`,
              'Modo assistido — envio automático desativado.',
            ].join('\n'),
            dueAt,
            priority: 'MEDIUM',
            status: 'OPEN',
          },
        }),
      ),
    );

    await this.prisma.campaignLead.updateMany({
      where: {
        campaignId,
        leadId: { in: eligible.map((cl) => cl.leadId) },
      },
      data: { status: `STAGE_${stage.type}` },
    });

    return {
      campaignId,
      stageId: stage.id,
      stageType: stage.type,
      tasksCreated: created.length,
      tasks: created,
      autoSend: false,
    };
  }

  getMetrics(organizationId: string, campaignId: string) {
    return this.requireCampaign(organizationId, campaignId).then((campaign) => {
      const metrics = parseCampaignMetrics(campaign.metrics);
      return {
        campaignId: campaign.id,
        status: campaign.status,
        assistedOnly: true,
        autoSendEnabled: false,
        stages: metrics.stages.map((stage) => ({
          id: stage.id,
          type: stage.type,
          name: stage.name,
          order: stage.order,
          metrics: stage.metrics ?? emptyStageMetrics(),
        })),
        placeholders: ['delivered', 'replied', 'interested', 'meeting', 'proposal', 'won'],
        note: 'Metric counters are placeholders until outreach events are instrumented.',
      };
    });
  }

  private buildStages(dto: CreateCampaignDto): CampaignStageDefinition[] {
    if (!dto.stages?.length) {
      return defaultStages();
    }
    return dto.stages.map((stage, index) => ({
      id: crypto.randomUUID(),
      type: stage.type,
      name: stage.name.trim(),
      order: stage.order ?? index + 1,
      templateId: stage.templateId,
      metrics: emptyStageMetrics(),
    }));
  }

  private async requireCampaign(organizationId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizationId },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  private async assertMember(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!member) {
      throw new BadRequestException('Assignee is not a member of this organization');
    }
  }
}
