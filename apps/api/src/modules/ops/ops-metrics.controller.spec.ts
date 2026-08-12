import { OpsMetricsController } from './ops-metrics.controller';
import { MetricsService } from './metrics.service';

describe('OpsMetricsController', () => {
  const makeQueue = (counts: Record<string, number>) => ({
    getJobCounts: jest.fn().mockResolvedValue(counts),
    client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
  });

  it('returns authenticated ops snapshot with queue depths', async () => {
    const metrics = new MetricsService();
    metrics.recordHttp('GET', 200, 12);
    metrics.recordJob('imports', 'completed', 40);

    const counts = {
      waiting: 1,
      active: 2,
      delayed: 0,
      failed: 3,
      completed: 10,
      paused: 0,
    };

    const controller = new OpsMetricsController(
      metrics,
      makeQueue(counts) as never,
      makeQueue(counts) as never,
      makeQueue(counts) as never,
      makeQueue(counts) as never,
      makeQueue(counts) as never,
    );

    const snapshot = await controller.getMetrics();
    expect(snapshot.http.total).toBe(1);
    expect(snapshot.jobs.imports?.completed).toBe(1);
    expect(snapshot.queues.prospecting).toEqual(counts);
    expect(snapshot.redis).toEqual({ status: 'up' });
    expect(snapshot.process.pid).toBe(process.pid);
  });

  it('reports redis down without leaking error details', async () => {
    const downQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
        paused: 0,
      }),
      client: Promise.resolve({
        ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED secret')),
      }),
    };

    const controller = new OpsMetricsController(
      new MetricsService(),
      downQueue as never,
      downQueue as never,
      downQueue as never,
      downQueue as never,
      downQueue as never,
    );

    const snapshot = await controller.getMetrics();
    expect(snapshot.redis).toEqual({ status: 'down' });
    expect(JSON.stringify(snapshot)).not.toContain('ECONNREFUSED');
  });
});
