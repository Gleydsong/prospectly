import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { CampaignsService } from './campaigns.service';
import type { TemplatesService } from './templates.service';

type MockFn = jest.Mock;

const makePrisma = () => {
  const prisma = {
    campaign: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    campaignLead: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    campaignActivity: {
      create: jest.fn(),
      groupBy: jest.fn(),
    },
    lead: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma as unknown as PrismaService & {
    campaign: {
      count: MockFn;
      findMany: MockFn;
      findFirst: MockFn;
      create: MockFn;
      update: MockFn;
    };
    campaignLead: {
      createMany: MockFn;
      findMany: MockFn;
      findFirst: MockFn;
      updateMany: MockFn;
      update: MockFn;
      delete: MockFn;
      count: MockFn;
      groupBy: MockFn;
    };
    campaignActivity: { create: MockFn; groupBy: MockFn };
    lead: { findMany: MockFn; update: MockFn };
    task: { create: MockFn; findMany: MockFn; count: MockFn; groupBy: MockFn };
    organizationMember: { findUnique: MockFn };
    $transaction: MockFn;
  };
};

const makeTemplates = () =>
  ({
    get: jest.fn(),
  }) as unknown as TemplatesService & { get: jest.Mock };

const makeAudit = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuditService & { log: jest.Mock };

const stageId = '11111111-1111-4111-8111-111111111111';
const stageIdCall = '22222222-2222-4222-8222-222222222222';
const emptyStageMetrics = {
  delivered: 0,
  replied: 0,
  interested: 0,
  meeting: 0,
  proposal: 0,
  won: 0,
};
const campaignWithStage = {
  id: 'c1',
  organizationId: 'org-a',
  ownerId: 'user-1',
  status: 'DRAFT' as const,
  startsAt: null,
  metrics: {
    stages: [
      {
        id: stageId,
        type: 'EMAIL_MANUAL',
        name: 'E-mail manual',
        order: 1,
        metrics: emptyStageMetrics,
      },
      {
        id: stageIdCall,
        type: 'CALL',
        name: 'Ligação',
        order: 2,
        metrics: emptyStageMetrics,
      },
    ],
  },
};

describe('CampaignsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list scopes queries to the authenticated organization', async () => {
    const prisma = makePrisma();
    prisma.campaign.count.mockResolvedValue(0);
    prisma.campaign.findMany.mockResolvedValue([]);
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await service.list('org-a', { page: 1, pageSize: 20 });

    expect(prisma.campaign.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
    });
  });

  it('get throws NotFound when campaign belongs to another org', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue(null);
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await expect(service.get('org-a', 'campaign-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create persists DRAFT campaign and writes audit without auto-send', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.campaign.create.mockResolvedValue({
      id: 'c1',
      name: 'Outbound SP',
      status: 'DRAFT',
      _count: { leads: 0 },
    });
    const service = new CampaignsService(prisma, makeTemplates(), audit);

    const result = await service.create('org-a', 'user-1', {
      name: 'Outbound SP',
      channel: 'ASSISTED',
    });

    expect(result.autoSendEnabled).toBe(false);
    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT', organizationId: 'org-a' }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'campaign.created',
        metadata: expect.objectContaining({ autoSend: false }),
      }),
    );
  });

  it('addLeads rejects leads outside the organization', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'org-a' });
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', doNotContact: false }]);
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await expect(
      service.addLeads('org-a', 'user-1', 'c1', { leadIds: ['lead-1', 'lead-2'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.campaignLead.createMany).not.toHaveBeenCalled();
  });

  it('addLeads rejects doNotContact leads', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'org-a' });
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', doNotContact: true }]);
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await expect(
      service.addLeads('org-a', 'user-1', 'c1', { leadIds: ['lead-1'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removeLead returns NotFound for another organization', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'org-a' });
    prisma.campaignLead.findFirst.mockResolvedValue(null);
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await expect(
      service.removeLead('org-a', 'user-1', 'c1', 'lead-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeLead deletes membership when found', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.campaign.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'org-a' });
    prisma.campaignLead.findFirst.mockResolvedValue({ campaignId: 'c1', leadId: 'lead-1' });
    prisma.campaignLead.delete.mockResolvedValue({});
    const service = new CampaignsService(prisma, makeTemplates(), audit);

    await expect(service.removeLead('org-a', 'user-1', 'c1', 'lead-1')).resolves.toEqual({
      campaignId: 'c1',
      leadId: 'lead-1',
      removed: true,
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaign.lead_removed' }),
    );
  });

  it('updateStatus rejects invalid transitions from CANCELLED', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'c1',
      organizationId: 'org-a',
      status: 'CANCELLED',
      startsAt: null,
    });
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await expect(
      service.updateStatus('org-a', 'user-1', 'c1', { status: 'RUNNING' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updateStatus moves DRAFT to RUNNING without enabling auto-send', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'c1',
      organizationId: 'org-a',
      status: 'DRAFT',
      startsAt: null,
    });
    prisma.campaign.update.mockResolvedValue({
      id: 'c1',
      status: 'RUNNING',
      _count: { leads: 0 },
    });
    const service = new CampaignsService(prisma, makeTemplates(), audit);

    const result = await service.updateStatus('org-a', 'user-1', 'c1', { status: 'RUNNING' });
    expect(result.autoSendEnabled).toBe(false);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'campaign.status_changed',
        metadata: expect.objectContaining({ autoSendTriggered: false }),
      }),
    );
  });

  it('createStageTasks is idempotent and skips existing campaign tasks', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.campaign.findFirst.mockResolvedValue(campaignWithStage);
    prisma.campaignLead.findMany.mockResolvedValue([
      {
        leadId: 'lead-1',
        lead: {
          id: 'lead-1',
          companyName: 'Acme',
          organizationId: 'org-a',
          doNotContact: false,
          deletedAt: null,
        },
      },
      {
        leadId: 'lead-2',
        lead: {
          id: 'lead-2',
          companyName: 'Beta',
          organizationId: 'org-a',
          doNotContact: false,
          deletedAt: null,
        },
      },
    ]);
    prisma.task.findMany.mockResolvedValue([{ id: 'task-existing', leadId: 'lead-1' }]);
    prisma.task.create.mockResolvedValue({ id: 'task-new', leadId: 'lead-2' });
    prisma.campaignLead.updateMany.mockResolvedValue({ count: 2 });
    const service = new CampaignsService(prisma, makeTemplates(), audit);

    const result = await service.createStageTasks('org-a', 'user-1', 'c1', stageId, {});

    expect(result.tasksCreated).toBe(1);
    expect(result.tasksSkipped).toBe(1);
    expect(result.autoSend).toBe(false);
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaign.tasks_created' }),
    );
  });

  it('createStageTasks ignores leads from another organization', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue(campaignWithStage);
    prisma.campaignLead.findMany.mockResolvedValue([
      {
        leadId: 'foreign',
        lead: {
          id: 'foreign',
          companyName: 'Other',
          organizationId: 'org-b',
          doNotContact: false,
          deletedAt: null,
        },
      },
    ]);
    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());

    await expect(
      service.createStageTasks('org-a', 'user-1', 'c1', stageId, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('createStageTasks includes leads already advanced to an earlier stage', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.campaign.findFirst.mockResolvedValue(campaignWithStage);
    prisma.campaignLead.findMany.mockResolvedValue([
      {
        leadId: 'lead-1',
        status: 'STAGE_EMAIL_MANUAL',
        currentStageId: stageId,
        lead: {
          id: 'lead-1',
          companyName: 'Acme',
          organizationId: 'org-a',
          doNotContact: false,
          deletedAt: null,
        },
      },
    ]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.task.create.mockResolvedValue({ id: 'task-call', leadId: 'lead-1' });
    prisma.campaignLead.updateMany.mockResolvedValue({ count: 1 });
    const service = new CampaignsService(prisma, makeTemplates(), audit);

    const result = await service.createStageTasks('org-a', 'user-1', 'c1', stageIdCall, {});

    expect(prisma.campaignLead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: 'c1',
          OR: [
            { status: 'PENDING' },
            { currentStageId: null },
            { currentStageId: { in: [stageId, stageIdCall] } },
          ],
        },
      }),
    );
    expect(result.tasksCreated).toBe(1);
    expect(result.stageId).toBe(stageIdCall);
    expect(prisma.campaignLead.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'STAGE_CALL', currentStageId: stageIdCall },
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaign.tasks_created' }),
    );
  });

  it('recordResult persists activity, updates lead, and opts out when requested', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.campaign.findFirst.mockResolvedValue(campaignWithStage);
    prisma.campaignLead.findFirst.mockResolvedValue({
      campaignId: 'c1',
      leadId: 'lead-1',
      currentStageId: stageId,
      lead: { id: 'lead-1', doNotContact: false },
    });
    prisma.campaignActivity.create.mockResolvedValue({
      id: 'act-1',
      result: 'OPT_OUT',
    });
    prisma.campaignLead.update.mockResolvedValue({});
    prisma.lead.update.mockResolvedValue({});
    const service = new CampaignsService(prisma, makeTemplates(), audit);

    const result = await service.recordResult('org-a', 'user-1', 'c1', 'lead-1', {
      result: 'OPT_OUT',
      note: 'Pediu remoção',
    });

    expect(result.messageSent).toBe(false);
    expect(result.autoSendEnabled).toBe(false);
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ doNotContact: true }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'campaign.result_recorded' }),
    );
  });

  it('getMetrics aggregates persisted events instead of placeholders', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue(campaignWithStage);
    prisma.task.count.mockResolvedValue(3);
    prisma.campaignLead.count.mockResolvedValueOnce(10).mockResolvedValueOnce(4);
    prisma.campaignActivity.groupBy.mockResolvedValue([
      { result: 'MEETING', _count: { _all: 2 } },
      { result: 'CONTACTED', _count: { _all: 4 } },
    ]);
    prisma.campaignLead.groupBy.mockImplementation(async (args: { by: string[] }) => {
      if (args.by.includes('result')) {
        return [
          { result: 'MEETING', _count: { _all: 2 } },
          { result: 'OPT_OUT', _count: { _all: 1 } },
        ];
      }
      return [{ currentStageId: stageId, _count: { _all: 5 } }];
    });
    prisma.task.groupBy.mockResolvedValue([{ campaignStageId: stageId, _count: { _all: 3 } }]);

    const service = new CampaignsService(prisma, makeTemplates(), makeAudit());
    const metrics = await service.getMetrics('org-a', 'c1');

    expect(metrics.instrumented).toBe(true);
    expect(metrics.autoSendEnabled).toBe(false);
    expect(metrics.eventsRecorded).toBe(6);
    expect(metrics.totals.meeting).toBe(2);
    expect(metrics.totals.optOut).toBe(1);
    expect(metrics.totals.openTasks).toBe(3);
  });
});
