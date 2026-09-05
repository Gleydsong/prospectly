import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  SavedViewVisibility,
  type CampaignLeadResult,
  type CampaignStatus,
  type Prisma,
} from '@prisma/client';

import { paginate } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { LeadsService } from '../../leads/leads.service';
import { OutboxService } from '../../outbox/outbox.service';
import { SuppressionService } from '../../privacy/suppression.service';
import {
  InvalidLeadViewDefinitionError,
  parseLeadViewDefinition,
} from '../../saved-views/domain/lead-view-definition';
import {
  defaultStages,
  emptyStageMetrics,
  parseCampaignMetrics,
  stageTaskTitle,
  type CampaignMetricsPayload,
  type CampaignStageDefinition,
} from '../domain/campaign-stages';
import { assertCampaignStatusTransition } from '../domain/campaign-status';
import {
  ADD_CAMPAIGN_LEADS_MAX,
  AddCampaignLeadsDto,
} from '../presentation/dto/add-campaign-leads.dto';
import { CreateCampaignDto } from '../presentation/dto/create-campaign.dto';
import { CreateStageTasksDto } from '../presentation/dto/create-stage-tasks.dto';
import { QueryCampaignLeadsDto } from '../presentation/dto/query-campaign-leads.dto';
import { QueryCampaignsDto } from '../presentation/dto/query-campaigns.dto';
import { RecordCampaignLeadResultDto } from '../presentation/dto/record-campaign-lead-result.dto';
import { UpdateCampaignLeadDto } from '../presentation/dto/update-campaign-lead.dto';
import { UpdateCampaignStatusDto } from '../presentation/dto/update-campaign-status.dto';
import { TemplatesService } from './templates.service';

const LEAD_SELECT = {
  id: true,
  companyName: true,
  tradeName: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  status: true,
  score: true,
  doNotContact: true,
  website: true,
} as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
    @Optional() private readonly suppression?: SuppressionService,
    @Optional() private readonly outbox?: OutboxService,
    @Optional() private readonly leads?: LeadsService,
  ) {}

  async list(organizationId: string, query: QueryCampaignsDto) {
    const where: Prisma.CampaignWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, data] = await Promise.all([
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
          include: { lead: { select: LEAD_SELECT } },
        },
        _count: { select: { leads: true, tasks: true, activities: true } },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const metrics = parseCampaignMetrics(campaign.metrics);
    const stageCounts = await this.countLeadsByStage(campaign.id, metrics.stages);

    return {
      ...campaign,
      metrics,
      stageCounts,
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

    const campaign = await this.prisma.campaign.create({
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

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CAMPAIGN_CREATED,
      entity: 'Campaign',
      entityId: campaign.id,
      metadata: { name: campaign.name, status: campaign.status, autoSend: false },
    });

    return { ...campaign, assistedOnly: true, autoSendEnabled: false };
  }

  async updateStatus(
    organizationId: string,
    userId: string,
    campaignId: string,
    dto: UpdateCampaignStatusDto,
  ) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    assertCampaignStatusTransition(campaign.status, dto.status);

    const data: Prisma.CampaignUpdateInput = { status: dto.status };
    if (dto.status === 'RUNNING' && !campaign.startsAt) {
      data.startsAt = new Date();
    }
    if (dto.status === 'COMPLETED' || dto.status === 'CANCELLED') {
      data.endsAt = new Date();
    }

    const updated = await this.prisma.campaign.update({
      where: { id: campaign.id },
      data,
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CAMPAIGN_STATUS_CHANGED,
      entity: 'Campaign',
      entityId: campaign.id,
      metadata: {
        from: campaign.status,
        to: dto.status,
        autoSend: false,
        autoSendTriggered: false,
      },
    });

    return { ...updated, assistedOnly: true, autoSendEnabled: false };
  }

  async addLeads(
    organizationId: string,
    userId: string,
    campaignId: string,
    dto: AddCampaignLeadsDto,
  ) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    const leadIds = await this.resolveLeadIds(organizationId, userId, dto);
    const leads = await this.prisma.lead.findMany({
      where: {
        organizationId,
        id: { in: leadIds },
        deletedAt: null,
      },
      select: { id: true, doNotContact: true },
    });
    if (leads.length !== leadIds.length) {
      throw new BadRequestException('One or more leads were not found in this organization');
    }
    const blocked = leads.filter((l) => l.doNotContact);
    if (blocked.length > 0) {
      throw new BadRequestException({
        message: 'Cannot add do-not-contact leads to a campaign',
        leadIds: blocked.map((l) => l.id),
      });
    }

    const result = await this.prisma.campaignLead.createMany({
      data: leadIds.map((leadId) => ({
        campaignId: campaign.id,
        leadId,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CAMPAIGN_LEADS_ADDED,
      entity: 'Campaign',
      entityId: campaign.id,
      metadata: {
        requested: leadIds.length,
        added: result.count,
        ...(dto.viewId ? { viewId: dto.viewId } : {}),
      },
    });

    return this.get(organizationId, campaignId);
  }

  async removeLead(organizationId: string, userId: string, campaignId: string, leadId: string) {
    await this.requireCampaign(organizationId, campaignId);
    const existing = await this.prisma.campaignLead.findFirst({
      where: {
        campaignId,
        leadId,
        campaign: { organizationId },
        lead: { organizationId, deletedAt: null },
      },
    });
    if (!existing) {
      throw new NotFoundException('Campaign lead not found');
    }

    await this.prisma.campaignLead.delete({
      where: { campaignId_leadId: { campaignId, leadId } },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CAMPAIGN_LEAD_REMOVED,
      entity: 'Campaign',
      entityId: campaignId,
      metadata: { leadId },
    });

    return { campaignId, leadId, removed: true };
  }

  async listLeads(organizationId: string, campaignId: string, query: QueryCampaignLeadsDto) {
    await this.requireCampaign(organizationId, campaignId);
    const where: Prisma.CampaignLeadWhereInput = {
      campaignId,
      campaign: { organizationId },
      lead: { organizationId, deletedAt: null },
      ...(query.status ? { status: query.status } : {}),
      ...(query.stageId ? { currentStageId: query.stageId } : {}),
    };

    const [total, data] = await Promise.all([
      this.prisma.campaignLead.count({ where }),
      this.prisma.campaignLead.findMany({
        where,
        include: { lead: { select: LEAD_SELECT } },
        orderBy: { addedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return paginate(data, total, query.page, query.pageSize);
  }

  async updateLead(
    organizationId: string,
    campaignId: string,
    leadId: string,
    dto: UpdateCampaignLeadDto,
  ) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    const metrics = parseCampaignMetrics(campaign.metrics);

    if (dto.currentStageId) {
      const stage = metrics.stages.find((s) => s.id === dto.currentStageId);
      if (!stage) {
        throw new BadRequestException('Unknown campaign stage');
      }
    }

    const existing = await this.prisma.campaignLead.findFirst({
      where: {
        campaignId,
        leadId,
        campaign: { organizationId },
        lead: { organizationId, deletedAt: null },
      },
    });
    if (!existing) {
      throw new NotFoundException('Campaign lead not found');
    }

    const stage = dto.currentStageId
      ? metrics.stages.find((s) => s.id === dto.currentStageId)
      : undefined;

    const updated = await this.prisma.campaignLead.update({
      where: { campaignId_leadId: { campaignId, leadId } },
      data: {
        ...(dto.currentStageId !== undefined
          ? {
              currentStageId: dto.currentStageId,
              status: stage ? `STAGE_${stage.type}` : existing.status,
            }
          : {}),
        ...(dto.nextAction !== undefined ? { nextAction: dto.nextAction.trim() || null } : {}),
        ...(dto.nextFollowUpAt !== undefined
          ? {
              nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
            }
          : {}),
      },
      include: { lead: { select: LEAD_SELECT } },
    });

    return updated;
  }

  async recordResult(
    organizationId: string,
    userId: string,
    campaignId: string,
    leadId: string,
    dto: RecordCampaignLeadResultDto,
  ) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    const metrics = parseCampaignMetrics(campaign.metrics);

    if (dto.stageId) {
      const stage = metrics.stages.find((s) => s.id === dto.stageId);
      if (!stage) {
        throw new BadRequestException('Unknown campaign stage');
      }
    }

    const existing = await this.prisma.campaignLead.findFirst({
      where: {
        campaignId,
        leadId,
        campaign: { organizationId },
        lead: { organizationId, deletedAt: null },
      },
      include: { lead: { select: { id: true, doNotContact: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Campaign lead not found');
    }

    const followUpAt = dto.followUpAt ? new Date(dto.followUpAt) : undefined;
    const now = new Date();
    const emitDoNotContact = dto.result === 'OPT_OUT' && !existing.lead.doNotContact;

    const [activity, event] = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campaignActivity.create({
        data: {
          organizationId,
          campaignId,
          leadId,
          userId,
          stageId: dto.stageId ?? existing.currentStageId,
          result: dto.result,
          note: dto.note?.trim(),
          nextAction: dto.nextAction?.trim(),
          followUpAt,
        },
      });

      await tx.campaignLead.update({
        where: { campaignId_leadId: { campaignId, leadId } },
        data: {
          result: dto.result,
          lastContactedAt: now,
          ...(dto.nextAction !== undefined ? { nextAction: dto.nextAction.trim() || null } : {}),
          ...(followUpAt !== undefined ? { nextFollowUpAt: followUpAt } : {}),
          ...(dto.stageId
            ? {
                currentStageId: dto.stageId,
                status: `STAGE_${metrics.stages.find((s) => s.id === dto.stageId)!.type}`,
              }
            : {}),
        },
      });

      if (dto.result === 'OPT_OUT') {
        await tx.lead.update({
          where: { id: leadId },
          data: { doNotContact: true },
        });
      }

      if (followUpAt) {
        await tx.lead.update({
          where: { id: leadId },
          data: { nextContactAt: followUpAt, lastContactAt: now },
        });
      } else {
        await tx.lead.update({
          where: { id: leadId },
          data: { lastContactAt: now },
        });
      }

      const outboxEvent =
        emitDoNotContact && this.outbox
          ? await this.outbox.appendLeadDoNotContactSet(tx, {
              organizationId,
              leadId,
              actorId: userId,
              payload: {
                leadId,
                source: 'CAMPAIGN_OPT_OUT',
                campaignId,
              },
            })
          : null;

      return [created, outboxEvent] as const;
    });

    if (event && this.outbox) {
      try {
        await this.outbox.dispatch(event);
      } catch {
        // Redis down: reconciler republishes from the persisted PENDING row.
      }
    }

    if (dto.result === 'OPT_OUT') {
      await this.suppression?.suppressFromLead(organizationId, leadId, 'campaign_opt_out');
    }

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CAMPAIGN_RESULT_RECORDED,
      entity: 'Campaign',
      entityId: campaignId,
      metadata: {
        leadId,
        result: dto.result,
        stageId: dto.stageId ?? existing.currentStageId,
        autoSend: false,
      },
    });

    return {
      activity,
      campaignId,
      leadId,
      result: dto.result,
      assistedOnly: true,
      autoSendEnabled: false,
      messageSent: false,
    };
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

    // Without explicit leadIds, include PENDING leads and leads already on this
    // stage or an earlier stage. Matching only PENDING/currentStageId left later
    // stages unreachable after the first "create tasks" advanced currentStageId.
    const reachableStageIds = metrics.stages
      .filter((candidate) => candidate.order <= stage.order)
      .map((candidate) => candidate.id);
    const leadFilter: Prisma.CampaignLeadWhereInput = dto.leadIds?.length
      ? { leadId: { in: dto.leadIds } }
      : {
          OR: [
            { status: 'PENDING' },
            { currentStageId: null },
            { currentStageId: { in: reachableStageIds } },
          ],
        };

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

    const existingTasks = await this.prisma.task.findMany({
      where: {
        organizationId,
        campaignId,
        campaignStageId: stageId,
        leadId: { in: eligible.map((cl) => cl.leadId) },
      },
      select: { id: true, leadId: true },
    });
    const existingLeadIds = new Set(existingTasks.map((t) => t.leadId).filter(Boolean));
    const toCreate = eligible.filter((cl) => !existingLeadIds.has(cl.leadId));

    const dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    const assigneeId = dto.assigneeId ?? campaign.ownerId ?? userId;

    const created = toCreate.length
      ? await this.prisma.$transaction(async (tx) =>
          Promise.all(
            toCreate.map((cl) =>
              tx.task.create({
                data: {
                  organizationId,
                  createdById: userId,
                  assigneeId,
                  leadId: cl.leadId,
                  campaignId,
                  campaignStageId: stageId,
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
          ),
        )
      : [];

    await this.prisma.campaignLead.updateMany({
      where: {
        campaignId,
        leadId: { in: eligible.map((cl) => cl.leadId) },
      },
      data: {
        status: `STAGE_${stage.type}`,
        currentStageId: stageId,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.CAMPAIGN_TASKS_CREATED,
      entity: 'Campaign',
      entityId: campaignId,
      metadata: {
        stageId,
        tasksCreated: created.length,
        tasksSkipped: existingTasks.length,
        autoSend: false,
      },
    });

    return {
      campaignId,
      stageId: stage.id,
      stageType: stage.type,
      tasksCreated: created.length,
      tasksSkipped: existingTasks.length,
      tasks: [...created, ...existingTasks],
      autoSend: false,
      messageSent: false,
    };
  }

  async getMetrics(organizationId: string, campaignId: string) {
    const campaign = await this.requireCampaign(organizationId, campaignId);
    const metrics = parseCampaignMetrics(campaign.metrics);

    const [leadGroups, openTasks, activities, totalLeads, pendingLeads] = await Promise.all([
      this.prisma.campaignLead.groupBy({
        by: ['result'],
        where: { campaignId, campaign: { organizationId } },
        _count: { _all: true },
      }),
      this.prisma.task.count({
        where: {
          organizationId,
          campaignId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.campaignActivity.groupBy({
        by: ['result'],
        where: { campaignId, organizationId },
        _count: { _all: true },
      }),
      this.prisma.campaignLead.count({
        where: { campaignId, campaign: { organizationId } },
      }),
      this.prisma.campaignLead.count({
        where: { campaignId, campaign: { organizationId }, status: 'PENDING' },
      }),
    ]);

    const resultCounts = this.emptyResultCounts();
    for (const row of leadGroups) {
      if (row.result) {
        resultCounts[row.result] = row._count._all;
      }
    }

    const eventCounts = this.emptyResultCounts();
    let eventsRecorded = 0;
    for (const row of activities) {
      eventCounts[row.result] = row._count._all;
      eventsRecorded += row._count._all;
    }

    const stageCounts = await this.countLeadsByStage(campaignId, metrics.stages);
    const openTasksByStage = await this.prisma.task.groupBy({
      by: ['campaignStageId'],
      where: {
        organizationId,
        campaignId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        campaignStageId: { not: null },
      },
      _count: { _all: true },
    });
    const openTaskMap = new Map(
      openTasksByStage.map((row) => [row.campaignStageId as string, row._count._all]),
    );

    return {
      campaignId: campaign.id,
      status: campaign.status as CampaignStatus,
      assistedOnly: true,
      autoSendEnabled: false,
      messageSent: false,
      eventsRecorded,
      instrumented: true,
      totals: {
        leads: totalLeads,
        pending: pendingLeads,
        openTasks,
        contacted: resultCounts.CONTACTED + resultCounts.REPLIED + resultCounts.INTERESTED,
        replied: resultCounts.REPLIED,
        interested: resultCounts.INTERESTED,
        meeting: resultCounts.MEETING,
        proposal: resultCounts.PROPOSAL,
        won: resultCounts.WON,
        lost: resultCounts.LOST,
        noResponse: resultCounts.NO_RESPONSE,
        optOut: resultCounts.OPT_OUT,
      },
      results: resultCounts,
      events: eventCounts,
      stages: metrics.stages.map((stage) => ({
        id: stage.id,
        type: stage.type,
        name: stage.name,
        order: stage.order,
        templateId: stage.templateId,
        leadCount: stageCounts[stage.id] ?? 0,
        openTasks: openTaskMap.get(stage.id) ?? 0,
      })),
    };
  }

  private emptyResultCounts(): Record<CampaignLeadResult, number> {
    return {
      CONTACTED: 0,
      REPLIED: 0,
      INTERESTED: 0,
      MEETING: 0,
      PROPOSAL: 0,
      WON: 0,
      LOST: 0,
      NO_RESPONSE: 0,
      OPT_OUT: 0,
    };
  }

  private async countLeadsByStage(
    campaignId: string,
    stages: CampaignStageDefinition[],
  ): Promise<Record<string, number>> {
    const groups = await this.prisma.campaignLead.groupBy({
      by: ['currentStageId'],
      where: { campaignId },
      _count: { _all: true },
    });
    const map: Record<string, number> = Object.fromEntries(stages.map((s) => [s.id, 0]));
    for (const row of groups) {
      if (row.currentStageId && row.currentStageId in map) {
        map[row.currentStageId] = row._count._all;
      }
    }
    return map;
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

  private async resolveLeadIds(
    organizationId: string,
    userId: string,
    dto: AddCampaignLeadsDto,
  ): Promise<string[]> {
    const hasIds = Array.isArray(dto.leadIds) && dto.leadIds.length > 0;
    const hasView = Boolean(dto.viewId);
    if (hasIds === hasView) {
      throw new BadRequestException('Provide either leadIds or viewId');
    }
    if (hasIds) {
      return dto.leadIds ?? [];
    }
    return this.resolveLeadIdsFromView(organizationId, userId, dto.viewId as string);
  }

  private async resolveLeadIdsFromView(
    organizationId: string,
    userId: string,
    viewId: string,
  ): Promise<string[]> {
    if (!this.leads) {
      throw new BadRequestException('Saved view membership is unavailable');
    }

    const view = await this.prisma.savedView.findFirst({
      where: {
        id: viewId,
        organizationId,
        archivedAt: null,
        OR: [{ ownerId: userId }, { visibility: SavedViewVisibility.TEAM }],
      },
    });
    if (!view) {
      throw new NotFoundException('Saved view not found');
    }

    let definition;
    try {
      definition = parseLeadViewDefinition(view.definition);
    } catch (error) {
      if (error instanceof InvalidLeadViewDefinitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const {
      layout: _layout,
      columns: _columns,
      sortBy: _sortBy,
      sortOrder: _sortOrder,
      ...filters
    } = definition;
    const { ids, total } = await this.leads.listIds(
      organizationId,
      filters,
      ADD_CAMPAIGN_LEADS_MAX + 1,
    );
    if (total === 0) {
      throw new BadRequestException('Vista has no matching leads');
    }
    if (total > ADD_CAMPAIGN_LEADS_MAX) {
      throw new BadRequestException({
        message: `Vista matches more than ${ADD_CAMPAIGN_LEADS_MAX} leads; narrow the filters before adding to a campaign`,
        total,
        max: ADD_CAMPAIGN_LEADS_MAX,
      });
    }
    return ids;
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
