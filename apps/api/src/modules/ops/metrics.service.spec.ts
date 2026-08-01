import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  it('aggregates HTTP counters and averages', () => {
    const metrics = new MetricsService();
    metrics.recordHttp('GET', 200, 10);
    metrics.recordHttp('GET', 200, 30);
    metrics.recordHttp('POST', 500, 50);

    expect(metrics.getHttpSnapshot()).toEqual({
      total: 3,
      errors5xx: 1,
      byMethod: { GET: 2, POST: 1 },
      byStatus: {
        '200': { count: 2, avgDurationMs: 20 },
        '500': { count: 1, avgDurationMs: 50 },
      },
    });
  });

  it('aggregates job completed/failed/retry with average duration', () => {
    const metrics = new MetricsService();
    metrics.recordJob('scoring', 'completed', 100);
    metrics.recordJob('scoring', 'completed', 300);
    metrics.recordJob('scoring', 'retry', 50);
    metrics.recordJob('scoring', 'failed', 20);

    expect(metrics.getJobSnapshot()).toEqual({
      scoring: {
        completed: 2,
        failed: 1,
        retries: 1,
        avgDurationMs: 118,
      },
    });
  });
});
