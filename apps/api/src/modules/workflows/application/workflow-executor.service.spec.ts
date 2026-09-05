import { OutboxEventStatus, Prisma, WorkflowStatus, WorkflowStepRunOutcome } from '@prisma/client';

import type { PrismaService } from '../../../common/prisma/prisma.service';
import { LEAD_CREATED_TYPE } from '../../outbox/outbox.constants';
import { WorkflowExecutorService } from './workflow-executor.service';

type MockFn = jest.Mock;

const makePrisma = () => {
  const prisma = {
    outboxEvent: { findUnique: jest.fn() },
    workflow: { findMany: jest.fn() },
    workflowVersion: { findFirst: jest.fn() },
    workflowStepRun: { findUnique: jest.fn(), create: jest.fn() },
    lead: { findFirst: jest.fn() },
    tag: { upsert: jest.fn() },
    leadTag: { createMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma as unknown as PrismaService & {
    outboxEvent: { findUnique: MockFn };
    workflow: { findMany: MockFn };
    workflowVersion: { findFirst: MockFn };
    workflowStepRun: { findUnique: MockFn; create: MockFn };
    lead: { findFirst: MockFn };
    tag: { upsert: MockFn };
    leadTag: { createMany: MockFn };
    $transaction: MockFn;
  };
};

const definition = {
  trigger: { type: 'lead.created' },
  steps: [{ type: 'add_tag', tagName: 'alto-potencial' }],
};

const processedEvent = {
  id: 'evt-1',
  organizationId: 'org-a',
  type: LEAD_CREATED_TYPE,
  status: OutboxEventStatus.PROCESSED,
  payload: { leadId: 'lead-1', source: 'MANUAL' },
};

const workflowRow = {
  id: 'wf-1',
  organizationId: 'org-a',
  status: WorkflowStatus.ACTIVE,
  archivedAt: null,
  publishedVersionId: 'ver-1',
};

const versionRow = {
  id: 'ver-1',
  organizationId: 'org-a',
  workflowId: 'wf-1',
  version: 1,
  definition,
};

describe('WorkflowExecutorService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('applies add_tag when an ACTIVE Fluxo matches lead.created', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findUnique.mockResolvedValue(processedEvent);
    prisma.workflow.findMany.mockResolvedValue([workflowRow]);
    prisma.workflowVersion.findFirst.mockResolvedValue(versionRow);
    prisma.workflowStepRun.findUnique.mockResolvedValue(null);
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', doNotContact: false });
    prisma.tag.upsert.mockResolvedValue({ id: 'tag-1', name: 'alto-potencial' });
    prisma.leadTag.createMany.mockResolvedValue({ count: 1 });
    prisma.workflowStepRun.create.mockResolvedValue({ outcome: WorkflowStepRunOutcome.APPLIED });
    const service = new WorkflowExecutorService(prisma);

    await service.handleOutboxEvent('evt-1');

    expect(prisma.tag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_name: { organizationId: 'org-a', name: 'alto-potencial' } },
      }),
    );
    expect(prisma.leadTag.createMany).toHaveBeenCalledWith({
      data: [{ leadId: 'lead-1', tagId: 'tag-1' }],
      skipDuplicates: true,
    });
    expect(prisma.workflowStepRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workflowVersionId: 'ver-1',
          eventId: 'evt-1',
          stepIndex: 0,
          outcome: WorkflowStepRunOutcome.APPLIED,
        }),
      }),
    );
  });

  it('skips a do-not-contact Lead without creating a tag', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findUnique.mockResolvedValue(processedEvent);
    prisma.workflow.findMany.mockResolvedValue([workflowRow]);
    prisma.workflowVersion.findFirst.mockResolvedValue(versionRow);
    prisma.workflowStepRun.findUnique.mockResolvedValue(null);
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', doNotContact: true });
    prisma.workflowStepRun.create.mockResolvedValue({ outcome: WorkflowStepRunOutcome.SKIPPED });
    const service = new WorkflowExecutorService(prisma);

    await service.handleOutboxEvent('evt-1');

    expect(prisma.tag.upsert).not.toHaveBeenCalled();
    expect(prisma.leadTag.createMany).not.toHaveBeenCalled();
    expect(prisma.workflowStepRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: WorkflowStepRunOutcome.SKIPPED }),
      }),
    );
  });

  it('does not duplicate LeadTag when the same event is redelivered', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findUnique.mockResolvedValue(processedEvent);
    prisma.workflow.findMany.mockResolvedValue([workflowRow]);
    prisma.workflowVersion.findFirst.mockResolvedValue(versionRow);
    prisma.workflowStepRun.findUnique.mockResolvedValue({
      id: 'run-1',
      outcome: WorkflowStepRunOutcome.APPLIED,
    });
    const service = new WorkflowExecutorService(prisma);

    await service.handleOutboxEvent('evt-1');

    expect(prisma.lead.findFirst).not.toHaveBeenCalled();
    expect(prisma.leadTag.createMany).not.toHaveBeenCalled();
    expect(prisma.workflowStepRun.create).not.toHaveBeenCalled();
  });

  it('treats a unique violation on the run as already applied', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findUnique.mockResolvedValue(processedEvent);
    prisma.workflow.findMany.mockResolvedValue([workflowRow]);
    prisma.workflowVersion.findFirst.mockResolvedValue(versionRow);
    prisma.workflowStepRun.findUnique.mockResolvedValue(null);
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', doNotContact: false });
    prisma.tag.upsert.mockResolvedValue({ id: 'tag-1', name: 'alto-potencial' });
    prisma.leadTag.createMany.mockResolvedValue({ count: 1 });
    prisma.workflowStepRun.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    const service = new WorkflowExecutorService(prisma);

    await expect(service.handleOutboxEvent('evt-1')).resolves.toBeUndefined();
  });

  it('skips when the published filter does not match', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findUnique.mockResolvedValue(processedEvent);
    prisma.workflow.findMany.mockResolvedValue([workflowRow]);
    prisma.workflowVersion.findFirst.mockResolvedValue({
      ...versionRow,
      definition: {
        ...definition,
        filter: { field: 'hasWebsite', op: 'eq', value: false },
      },
    });
    prisma.workflowStepRun.findUnique.mockResolvedValue(null);
    prisma.lead.findFirst
      .mockResolvedValueOnce({ id: 'lead-1', doNotContact: false })
      .mockResolvedValueOnce(null);
    prisma.workflowStepRun.create.mockResolvedValue({ outcome: WorkflowStepRunOutcome.SKIPPED });
    const service = new WorkflowExecutorService(prisma);

    await service.handleOutboxEvent('evt-1');

    expect(prisma.leadTag.createMany).not.toHaveBeenCalled();
    expect(prisma.workflowStepRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ outcome: WorkflowStepRunOutcome.SKIPPED }),
      }),
    );
  });

  it('ignores events that are not PROCESSED lead.created', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findUnique.mockResolvedValue({
      ...processedEvent,
      type: 'task.completed',
    });
    const service = new WorkflowExecutorService(prisma);
    await service.handleOutboxEvent('evt-1');
    expect(prisma.workflow.findMany).not.toHaveBeenCalled();
  });
});
