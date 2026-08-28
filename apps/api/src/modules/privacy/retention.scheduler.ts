import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  PRIVACY_RETENTION_QUEUE,
  PROCESS_PRIVACY_RETENTION_JOB,
} from './retention.constants';

@Injectable()
export class RetentionScheduler implements OnModuleInit {
  private readonly logger = new Logger(RetentionScheduler.name);

  constructor(
    @InjectQueue(PRIVACY_RETENTION_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      PROCESS_PRIVACY_RETENTION_JOB,
      {},
      {
        jobId: PROCESS_PRIVACY_RETENTION_JOB,
        repeat: { every: 24 * 60 * 60 * 1000 },
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );
    this.logger.log('Privacy retention repeatable job registered (24h)');
  }
}
