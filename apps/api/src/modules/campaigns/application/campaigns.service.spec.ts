import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../../common/prisma/prisma.service';
import { CampaignsService } from './campaigns.service';
import type { TemplatesService } from './templates.service';

const makePrisma = () => {
  const prisma = {
    campaign: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    campaignLead: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    lead: {
      findMany: jest.fn(),
    },
    task: {
      create: jest.fn(),
    },
    organizationMember: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  return prisma as unknown as PrismaService & {
    campaign: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    campaignLead: {
      createMany: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    lead: { findMany: jest.Mock };
    task: { create: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
};

const makeTemplates = () =>
  ({
    get: jest.fn(),
  }) as unknown as TemplatesService & { get: jest.Mock };

describe('CampaignsService org isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('list scopes queries to the authenticated organization', async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new CampaignsService(prisma, makeTemplates());

    await service.list('org-a', { page: 1, pageSize: 20 });

    expect(prisma.campaign.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
    });
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a' },
      }),
    );
  });

  it('get throws NotFound when campaign belongs to another org', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue(null);
    const service = new CampaignsService(prisma, makeTemplates());

    await expect(service.get('org-a', 'campaign-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'campaign-1', organizationId: 'org-a' },
      }),
    );
  });

  it('addLeads rejects leads outside the organization', async () => {
    const prisma = makePrisma();
    prisma.campaign.findFirst.mockResolvedValue({ id: 'c1', organizationId: 'org-a' });
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', doNotContact: false }]);
    const service = new CampaignsService(prisma, makeTemplates());

    await expect(
      service.addLeads('org-a', 'c1', { leadIds: ['lead-1', 'lead-2'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.campaignLead.createMany).not.toHaveBeenCalled();
  });

  it('createStageTasks only creates tasks for leads in the same organization', async () => {
    const prisma = makePrisma();
    const stageId = 'stage-1';
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'c1',
      organizationId: 'org-a',
      name: 'Cadência',
      ownerId: 'user-1',
      metrics: {
        stages: [
          {
            id: stageId,
            type: 'EMAIL_MANUAL',
            name: 'E-mail',
            order: 1,
            metrics: {
              delivered: 0,
              replied: 0,
              interested: 0,
              meeting: 0,
              proposal: 0,
              won: 0,
            },
          },
        ],
      },
    });
    prisma.campaignLead.findMany.mockResolvedValue([
      {
        leadId: 'lead-1',
        lead: {
          id: 'lead-1',
          companyName: 'ACME',
          organizationId: 'org-a',
          doNotContact: false,
          deletedAt: null,
        },
      },
      {
        leadId: 'lead-x',
        lead: {
          id: 'lead-x',
          companyName: 'Other Org Co',
          organizationId: 'org-b',
          doNotContact: false,
          deletedAt: null,
        },
      },
    ]);
    prisma.task.create.mockResolvedValue({ id: 'task-1' });
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    prisma.campaignLead.updateMany.mockResolvedValue({ count: 1 });

    const service = new CampaignsService(prisma, makeTemplates());
    const result = await service.createStageTasks('org-a', 'user-1', 'c1', stageId, {});

    expect(result.tasksCreated).toBe(1);
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          leadId: 'lead-1',
        }),
      }),
    );
  });
});
