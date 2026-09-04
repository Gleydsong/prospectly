import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import type { AuditService } from '../audit/audit.service';
import type { OutboxService } from '../outbox/outbox.service';
import { PipelinesService } from './pipelines.service';

const makePrisma = () => {
  const prisma: {
    pipeline: { findFirst: jest.Mock };
    pipelineStage: { findMany: jest.Mock; findFirst: jest.Mock };
    lead: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    leadActivity: { create: jest.Mock };
    $transaction: jest.Mock;
  } = {
    pipeline: {
      findFirst: jest.fn(),
    },
    pipelineStage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    leadActivity: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma as unknown as PrismaService & typeof prisma;
};

const makeAudit = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuditService;

const makeOutbox = () =>
  ({
    appendLeadStageChanged: jest.fn().mockResolvedValue({
      id: 'outbox-1',
      organizationId: 'org-1',
      correlationId: null,
    }),
    dispatch: jest.fn().mockResolvedValue(undefined),
  }) as unknown as OutboxService & {
    appendLeadStageChanged: jest.Mock;
    dispatch: jest.Mock;
  };

describe('PipelinesService', () => {
  it('returns totalCount and hasMore when a stage exceeds the page size', async () => {
    const prisma = makePrisma();
    prisma.pipeline.findFirst.mockResolvedValue({
      id: 'pipe-1',
      name: 'Default',
      organizationId: 'org-1',
    });
    prisma.pipelineStage.findMany.mockResolvedValue([
      { id: 'stage-1', name: 'New', pipelineId: 'pipe-1', order: 0 },
    ]);
    prisma.lead.count.mockResolvedValue(120);
    prisma.lead.findMany.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({ id: `lead-${i}` })),
    );

    const service = new PipelinesService(prisma, makeAudit(), makeOutbox());
    const board = await service.getBoard('org-1', { limit: 50, offset: 0 });
    const firstStage = board.stages[0];
    expect(firstStage).toBeDefined();
    expect(firstStage!.totalCount).toBe(120);
    expect(firstStage!.hasMore).toBe(true);
    expect(firstStage!.leads).toHaveLength(50);
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 0,
        where: { organizationId: 'org-1', stageId: 'stage-1', deletedAt: null },
      }),
    );
  });

  it('paginates stage leads past the first hundred records', async () => {
    const prisma = makePrisma();
    prisma.pipelineStage.findFirst.mockResolvedValue({
      id: 'stage-1',
      name: 'New',
      pipelineId: 'pipe-1',
    });
    prisma.lead.count.mockResolvedValue(150);
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-101' }]);

    const service = new PipelinesService(prisma, makeAudit(), makeOutbox());
    const page = await service.listStageLeads('org-1', 'stage-1', { limit: 50, offset: 100 });

    expect(page.totalCount).toBe(150);
    expect(page.hasMore).toBe(true);
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        skip: 100,
        where: { organizationId: 'org-1', stageId: 'stage-1', deletedAt: null },
      }),
    );
  });

  it('rejects moving a lead to a stage outside the organization', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-a',
      stage: { id: 'stage-a', name: 'A' },
    });
    prisma.pipelineStage.findFirst.mockResolvedValue(null);

    const service = new PipelinesService(prisma, makeAudit(), makeOutbox());
    await expect(
      service.moveLeadToStage('org-1', 'lead-1', 'foreign-stage', 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects moving a lead that does not belong to the organization', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);

    const service = new PipelinesService(prisma, makeAudit(), makeOutbox());
    await expect(
      service.moveLeadToStage('org-1', 'missing', 'stage-1', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('moves a lead between stages and records activity plus outbox event in the same transaction', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const outbox = makeOutbox();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-a',
      stage: { id: 'stage-a', name: 'A' },
    });
    prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-b', name: 'B' });
    prisma.lead.update.mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-b',
      stage: { id: 'stage-b', name: 'B' },
    });
    prisma.leadActivity.create.mockResolvedValue({});

    const service = new PipelinesService(prisma, audit, outbox);
    const updated = await service.moveLeadToStage(
      'org-1',
      'lead-1',
      'stage-b',
      'user-1',
      'corr-stage',
    );

    expect(updated.stageId).toBe('stage-b');
    expect(prisma.leadActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'STAGE_CHANGED',
        metadata: { fromStageId: 'stage-a', toStageId: 'stage-b' },
      }),
    });
    expect(outbox.appendLeadStageChanged).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        organizationId: 'org-1',
        leadId: 'lead-1',
        actorId: 'user-1',
        correlationId: 'corr-stage',
        payload: {
          leadId: 'lead-1',
          fromStageId: 'stage-a',
          toStageId: 'stage-b',
          fromStageName: 'A',
          toStageName: 'B',
        },
      }),
    );
    expect(outbox.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'outbox-1', organizationId: 'org-1' }),
    );
    expect(audit.log).toHaveBeenCalled();
  });

  it('does not append an outbox event when the lead is already in the target stage', async () => {
    const prisma = makePrisma();
    const outbox = makeOutbox();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-a',
      stage: { id: 'stage-a', name: 'A' },
    });
    prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-a', name: 'A' });

    const service = new PipelinesService(prisma, makeAudit(), outbox);
    await service.moveLeadToStage('org-1', 'lead-1', 'stage-a', 'user-1');

    expect(outbox.appendLeadStageChanged).not.toHaveBeenCalled();
    expect(outbox.dispatch).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not dispatch when the outbox insert fails inside the business transaction', async () => {
    const prisma = makePrisma();
    const outbox = makeOutbox();
    prisma.lead.findFirst.mockResolvedValue({
      id: 'lead-1',
      stageId: 'stage-a',
      stage: { id: 'stage-a', name: 'A' },
    });
    prisma.pipelineStage.findFirst.mockResolvedValue({ id: 'stage-b', name: 'B' });
    outbox.appendLeadStageChanged.mockRejectedValue(new Error('outbox fail'));

    const service = new PipelinesService(prisma, makeAudit(), outbox);
    await expect(service.moveLeadToStage('org-1', 'lead-1', 'stage-b', 'user-1')).rejects.toThrow(
      'outbox fail',
    );
    expect(outbox.dispatch).not.toHaveBeenCalled();
  });
});
