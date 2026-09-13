import { RETENTION } from './retention.constants';
import { RetentionService } from './retention.service';

function makePrisma(overrides?: {
  outboxFindMany?: jest.Mock;
  outboxDeleteMany?: jest.Mock;
}) {
  return {
    refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    importError: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    outboxEvent: {
      findMany: overrides?.outboxFindMany ?? jest.fn().mockResolvedValue([]),
      deleteMany: overrides?.outboxDeleteMany ?? jest.fn().mockResolvedValue({ count: 0 }),
    },
    syncedCommunication: { deleteMany: jest.fn() },
  };
}

describe('RetentionService', () => {
  it('clears expired auth secrets and old import error payloads', async () => {
    const prisma = makePrisma();
    const service = new RetentionService(prisma as never);
    const result = await service.run();
    expect(result.revokedTokens).toBe(2);
    expect(result.expiredTokens).toBe(2);
    expect(result.expiredAuthSecrets).toBe(2);
    expect(result.importErrorsCleared).toBe(3);
    expect(result.outboxEventsDeleted).toBe(0);
    expect(prisma.importError.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ data: expect.anything() }),
      }),
    );
  });

  it('deletes only OutboxEvent rows whose retainUntil has passed, in batches', async () => {
    const outboxFindMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'expired-1' }, { id: 'expired-dead' }])
      .mockResolvedValueOnce([]);
    const outboxDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const prisma = makePrisma({ outboxFindMany, outboxDeleteMany });
    const service = new RetentionService(prisma as never);

    const result = await service.run();

    expect(result.outboxEventsDeleted).toBe(2);
    expect(outboxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { retainUntil: { lt: expect.any(Date) } },
        select: { id: true },
        take: RETENTION.outboxEventGcBatchSize,
        orderBy: { retainUntil: 'asc' },
      }),
    );
    expect(outboxFindMany.mock.calls[0][0].where.status).toBeUndefined();
    expect(outboxDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['expired-1', 'expired-dead'] } },
    });
    expect(prisma.syncedCommunication.deleteMany).not.toHaveBeenCalled();
  });

  it('stops after a partial batch and is a no-op when nothing is expired', async () => {
    const outboxFindMany = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'expired-1' }])
      .mockResolvedValueOnce([]);
    const outboxDeleteMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });
    const prisma = makePrisma({ outboxFindMany, outboxDeleteMany });
    const service = new RetentionService(prisma as never);

    const first = await service.run();
    expect(first.outboxEventsDeleted).toBe(1);

    outboxFindMany.mockResolvedValue([]);
    const second = await service.run();
    expect(second.outboxEventsDeleted).toBe(0);
    expect(outboxDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('keeps deleting while a full GC batch is returned', async () => {
    const fullBatch = Array.from({ length: RETENTION.outboxEventGcBatchSize }, (_, index) => ({
      id: `expired-${index}`,
    }));
    const outboxFindMany = jest
      .fn()
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([{ id: 'expired-tail' }]);
    const outboxDeleteMany = jest
      .fn()
      .mockResolvedValueOnce({ count: fullBatch.length })
      .mockResolvedValueOnce({ count: 1 });
    const prisma = makePrisma({ outboxFindMany, outboxDeleteMany });
    const service = new RetentionService(prisma as never);

    const result = await service.run();

    expect(result.outboxEventsDeleted).toBe(fullBatch.length + 1);
    expect(outboxDeleteMany).toHaveBeenCalledTimes(2);
  });
});
