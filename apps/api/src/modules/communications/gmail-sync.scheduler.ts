import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  GMAIL_SWEEP_EVERY_MS,
  GMAIL_SYNC_QUEUE,
  SWEEP_GMAIL_CONNECTIONS_JOB,
} from './communications.constants';

@Injectable()
export class GmailSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(GmailSyncScheduler.name);

  constructor(@InjectQueue(GMAIL_SYNC_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      SWEEP_GMAIL_CONNECTIONS_JOB,
      {},
      {
        jobId: SWEEP_GMAIL_CONNECTIONS_JOB,
        repeat: { every: GMAIL_SWEEP_EVERY_MS },
        removeOnComplete: 20,
        removeOnFail: 50,
      },
    );
    this.logger.log('Gmail sync sweep registered (15m)');
  }
}
