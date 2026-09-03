import { Injectable } from '@nestjs/common';

export type JobOutcome = 'completed' | 'failed' | 'retry';

type HttpBucket = {
  count: number;
  durationMsSum: number;
};

type JobBucket = {
  completed: number;
  failed: number;
  retries: number;
  durationMsSum: number;
  durationMsCount: number;
};

@Injectable()
export class MetricsService {
  private readonly startedAt = new Date();
  private httpTotal = 0;
  private httpErrors = 0;
  private readonly httpByStatus = new Map<string, HttpBucket>();
  private readonly httpByMethod = new Map<string, number>();
  private readonly jobsByQueue = new Map<string, JobBucket>();

  private jobsRecovered = 0;
  private webhookDuplicates = 0;
  private webhookProcessed = 0;
  private webhookFailed = 0;
  private redisErrors = 0;
  private creditFailures = 0;
  private dbTransactionFailures = 0;

  recordHttp(method: string, statusCode: number, durationMs: number): void {
    this.httpTotal += 1;
    if (statusCode >= 500) {
      this.httpErrors += 1;
    }

    const methodKey = method.toUpperCase();
    this.httpByMethod.set(methodKey, (this.httpByMethod.get(methodKey) ?? 0) + 1);

    const statusKey = String(statusCode);
    const bucket = this.httpByStatus.get(statusKey) ?? { count: 0, durationMsSum: 0 };
    bucket.count += 1;
    bucket.durationMsSum += Math.max(0, durationMs);
    this.httpByStatus.set(statusKey, bucket);
  }

  recordJob(queue: string, outcome: JobOutcome, durationMs?: number): void {
    const bucket = this.jobsByQueue.get(queue) ?? {
      completed: 0,
      failed: 0,
      retries: 0,
      durationMsSum: 0,
      durationMsCount: 0,
    };

    if (outcome === 'completed') bucket.completed += 1;
    if (outcome === 'failed') bucket.failed += 1;
    if (outcome === 'retry') bucket.retries += 1;

    if (typeof durationMs === 'number' && Number.isFinite(durationMs)) {
      bucket.durationMsSum += Math.max(0, durationMs);
      bucket.durationMsCount += 1;
    }

    this.jobsByQueue.set(queue, bucket);
  }

  recordJobRecovered(): void {
    this.jobsRecovered += 1;
  }

  recordWebhookDuplicate(): void {
    this.webhookDuplicates += 1;
  }

  recordWebhookProcessed(): void {
    this.webhookProcessed += 1;
  }

  recordWebhookFailed(): void {
    this.webhookFailed += 1;
  }

  recordRedisError(): void {
    this.redisErrors += 1;
  }

  recordCreditFailure(): void {
    this.creditFailures += 1;
  }

  recordDbTransactionFailure(): void {
    this.dbTransactionFailures += 1;
  }

  getHttpSnapshot() {
    const byStatus: Record<string, { count: number; avgDurationMs: number }> = {};
    for (const [status, bucket] of this.httpByStatus.entries()) {
      byStatus[status] = {
        count: bucket.count,
        avgDurationMs:
          bucket.count === 0 ? 0 : Math.round(bucket.durationMsSum / bucket.count),
      };
    }

    return {
      total: this.httpTotal,
      errors5xx: this.httpErrors,
      byMethod: Object.fromEntries(this.httpByMethod.entries()),
      byStatus,
    };
  }

  getJobSnapshot() {
    const queues: Record<
      string,
      {
        completed: number;
        failed: number;
        retries: number;
        avgDurationMs: number;
      }
    > = {};

    for (const [queue, bucket] of this.jobsByQueue.entries()) {
      queues[queue] = {
        completed: bucket.completed,
        failed: bucket.failed,
        retries: bucket.retries,
        avgDurationMs:
          bucket.durationMsCount === 0
            ? 0
            : Math.round(bucket.durationMsSum / bucket.durationMsCount),
      };
    }

    return queues;
  }

  getReliabilitySnapshot() {
    return {
      webhooks: {
        duplicates: this.webhookDuplicates,
        processed: this.webhookProcessed,
        failed: this.webhookFailed,
      },
      redisErrors: this.redisErrors,
      creditFailures: this.creditFailures,
      dbTransactionFailures: this.dbTransactionFailures,
      jobsRecovered: this.jobsRecovered,
    };
  }

  getProcessSnapshot() {
    const memory = process.memoryUsage();
    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      pid: process.pid,
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
    };
  }
}
