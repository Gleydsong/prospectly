import { HealthController } from './health.controller';

describe('HealthController readiness', () => {
  it('reports ready only after PostgreSQL and Redis respond', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const redis = { ping: jest.fn().mockResolvedValue('PONG') };
    const queue = { client: Promise.resolve(redis) };
    const controller = new HealthController(prisma as never, queue as never);

    await expect(controller.readiness()).resolves.toEqual(
      expect.objectContaining({ status: 'ready' }),
    );
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });

  it('returns not ready when Redis is unavailable even if PostgreSQL is up', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const redis = { ping: jest.fn().mockRejectedValue(new Error('redis secret detail')) };
    const controller = new HealthController(prisma as never, { client: Promise.resolve(redis) } as never);

    await expect(controller.readiness()).rejects.toMatchObject({
      response: { status: 'not_ready' },
    });
  });
});
