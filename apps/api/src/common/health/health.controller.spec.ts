import { HealthController } from './health.controller';

describe('HealthController readiness', () => {
  it('reports ready after PostgreSQL responds even if Redis is down', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as never);

    await expect(controller.readiness()).resolves.toEqual(
      expect.objectContaining({ status: 'ready' }),
    );
  });

  it('returns not ready when PostgreSQL is unavailable', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('pg timeout')) };
    const controller = new HealthController(prisma as never);

    await expect(controller.readiness()).rejects.toMatchObject({
      response: { status: 'not_ready' },
    });
  });
});
