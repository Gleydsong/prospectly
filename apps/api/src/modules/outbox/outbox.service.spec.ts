import { OutboxEventStatus } from '@prisma/client';

import { OUTBOX_JOB_STALE_MS } from '../../common/workers/durable-job';
import {
  LEAD_CREATED_TYPE,
  LEAD_STAGE_CHANGED_TYPE,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_QUEUE,
  PUBLISH_OUTBOX_JOB,
  outboxJobId,
} from './outbox.constants';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const makeQueue = () => ({
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  });

  const makePrisma = () => ({
    outboxEvent: {
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
  });

  it('appends lead.stage_changed without contact PII and with 90-day retention', async () => {
    const prisma = makePrisma();
    const created = {
      id: 'event-1',
      type: LEAD_STAGE_CHANGED_TYPE,
      payload: { leadId: 'lead-1', toStageId: 'stage-b' },
    };
    prisma.outboxEvent.create.mockResolvedValue(created);
    const service = new OutboxService(prisma as never, makeQueue() as never);
    const tx = { outboxEvent: prisma.outboxEvent };

    const result = await service.appendLeadStageChanged(tx as never, {
      organizationId: 'org-1',
      leadId: 'lead-1',
      actorId: 'user-1',
      correlationId: 'corr-1',
      payload: {
        leadId: 'lead-1',
        fromStageId: 'stage-a',
        toStageId: 'stage-b',
        fromStageName: 'A',
        toStageName: 'B',
      },
    });

    expect(result).toBe(created);
    const data = prisma.outboxEvent.create.mock.calls[0]?.[0]?.data;
    expect(data.type).toBe(LEAD_STAGE_CHANGED_TYPE);
    expect(data.payload).toEqual({
      leadId: 'lead-1',
      fromStageId: 'stage-a',
      toStageId: 'stage-b',
      fromStageName: 'A',
      toStageName: 'B',
    });
    expect(JSON.stringify(data.payload)).not.toMatch(/email|phone|whatsapp/i);
    expect(data.idempotencyKey).toContain(LEAD_STAGE_CHANGED_TYPE);
    expect(data.idempotencyKey).toContain('lead-1');
    expect(data.retainUntil.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);
    expect(data.status).toBe(OutboxEventStatus.PENDING);
  });

  it('appends lead.created keyed by lead id without contact PII', async () => {
    const prisma = makePrisma();
    const created = {
      id: 'event-created',
      type: LEAD_CREATED_TYPE,
      payload: { leadId: 'lead-9', source: 'MANUAL', ownerId: 'user-1', stageId: null },
    };
    prisma.outboxEvent.create.mockResolvedValue(created);
    const service = new OutboxService(prisma as never, makeQueue() as never);
    const tx = { outboxEvent: prisma.outboxEvent };

    const result = await service.appendLeadCreated(tx as never, {
      organizationId: 'org-1',
      leadId: 'lead-9',
      actorId: 'user-1',
      correlationId: 'corr-9',
      payload: {
        leadId: 'lead-9',
        source: 'MANUAL',
        ownerId: 'user-1',
        stageId: null,
      },
    });

    expect(result).toBe(created);
    const data = prisma.outboxEvent.create.mock.calls[0]?.[0]?.data;
    expect(data.type).toBe(LEAD_CREATED_TYPE);
    expect(data.idempotencyKey).toBe(`${LEAD_CREATED_TYPE}:lead-9`);
    expect(data.payload).toEqual({
      leadId: 'lead-9',
      source: 'MANUAL',
      ownerId: 'user-1',
      stageId: null,
    });
    expect(JSON.stringify(data.payload)).not.toMatch(/email|phone|whatsapp/i);
    expect(data.status).toBe(OutboxEventStatus.PENDING);
  });

  it('dispatches with deterministic jobId outbox-<id> and records jobDispatchedAt', async () => {
    const prisma = makePrisma();
    const queue = makeQueue();
    const service = new OutboxService(prisma as never, queue as never);

    await service.dispatch({ id: 'evt-9', organizationId: 'org-1', correlationId: 'corr-9' });

    expect(queue.add).toHaveBeenCalledWith(
      PUBLISH_OUTBOX_JOB,
      { eventId: 'evt-9', organizationId: 'org-1', correlationId: 'corr-9' },
      expect.objectContaining({ jobId: outboxJobId('evt-9') }),
    );
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'evt-9',
        status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
      },
      data: { jobDispatchedAt: expect.any(Date) },
    });
  });

  it('recovers crash between persist and publish by rediscovering undispatched rows', async () => {
    const prisma = makePrisma();
    const queue = makeQueue();
    prisma.outboxEvent.findMany.mockResolvedValue([
      { id: 'evt-pending', organizationId: 'org-1', correlationId: null, jobDispatchedAt: null },
    ]);
    const service = new OutboxService(prisma as never, queue as never);

    const dispatched = await service.reconcilePending();

    expect(dispatched).toBe(1);
    expect(queue.add).toHaveBeenCalledWith(
      PUBLISH_OUTBOX_JOB,
      { eventId: 'evt-pending', organizationId: 'org-1' },
      expect.objectContaining({ jobId: 'outbox-evt-pending' }),
    );
    expect(OUTBOX_JOB_STALE_MS).toBe(2 * 60 * 1000);
  });

  it('processes a claimed event exactly once and ignores a lost concurrent claim', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'evt-1',
      type: LEAD_STAGE_CHANGED_TYPE,
      organizationId: 'org-1',
      correlationId: 'corr-1',
      attempts: 1,
      payload: {
        leadId: 'lead-1',
        fromStageId: 'stage-a',
        toStageId: 'stage-b',
        fromStageName: 'A',
        toStageName: 'B',
      },
    });
    const service = new OutboxService(prisma as never, makeQueue() as never);

    await service.process('evt-1');
    await service.process('evt-1');

    const processedWrites = prisma.outboxEvent.updateMany.mock.calls.filter(
      (call) => call[0]?.data?.status === OutboxEventStatus.PROCESSED,
    );
    expect(processedWrites).toHaveLength(1);
  });

  it('replays a already-processed event as a no-op', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 0 });
    const service = new OutboxService(prisma as never, makeQueue() as never);

    await service.process('evt-done');

    expect(prisma.outboxEvent.findUnique).not.toHaveBeenCalled();
  });

  it('moves a poison event to DEAD after 10 failed attempts', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'evt-poison',
      type: LEAD_STAGE_CHANGED_TYPE,
      organizationId: 'org-1',
      correlationId: null,
      attempts: OUTBOX_MAX_ATTEMPTS,
      payload: { email: 'secret@example.test' },
    });
    const service = new OutboxService(prisma as never, makeQueue() as never);

    await expect(service.process('evt-poison')).rejects.toThrow(/PII|payload/i);
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt-poison' },
      data: expect.objectContaining({ status: OutboxEventStatus.DEAD }),
    });
  });

  it('does not enqueue to tenant webhook URLs', async () => {
    const prisma = makePrisma();
    const queue = makeQueue();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'evt-1',
      type: LEAD_STAGE_CHANGED_TYPE,
      organizationId: 'org-1',
      correlationId: null,
      attempts: 1,
      payload: { leadId: 'lead-1', toStageId: 'stage-b' },
    });
    const service = new OutboxService(prisma as never, queue as never);
    await service.process('evt-1');
    expect(JSON.stringify(queue.add.mock.calls)).not.toMatch(/webhook|http/i);
    expect(OUTBOX_QUEUE).toBe('outbox');
  });

  it('reclaims stale PROCESSING even after 10 attempts', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'evt-stale',
      type: LEAD_STAGE_CHANGED_TYPE,
      organizationId: 'org-1',
      correlationId: 'corr-stale',
      attempts: OUTBOX_MAX_ATTEMPTS + 1,
      status: OutboxEventStatus.PROCESSING,
      payload: { leadId: 'lead-1', toStageId: 'stage-b' },
    });
    const service = new OutboxService(prisma as never, makeQueue() as never);

    await service.process('evt-stale');

    const claim = prisma.outboxEvent.updateMany.mock.calls[0]?.[0];
    expect(claim.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: OutboxEventStatus.PROCESSING,
          updatedAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      ]),
    );
    expect(claim.where.OR[1].attempts).toBeUndefined();
    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt-stale' },
      data: expect.objectContaining({ status: OutboxEventStatus.PROCESSED }),
    });
  });

  it('processes lead.created without requiring stage fields', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.updateMany.mockResolvedValue({ count: 1 });
    prisma.outboxEvent.findUnique.mockResolvedValue({
      id: 'evt-created',
      type: LEAD_CREATED_TYPE,
      organizationId: 'org-1',
      correlationId: 'corr-c',
      attempts: 1,
      payload: {
        leadId: 'lead-9',
        source: 'GOOGLE_PLACES',
        ownerId: 'user-1',
        stageId: null,
      },
    });
    const service = new OutboxService(prisma as never, makeQueue() as never);

    await service.process('evt-created');

    expect(prisma.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: 'evt-created' },
      data: expect.objectContaining({ status: OutboxEventStatus.PROCESSED }),
    });
  });
});
