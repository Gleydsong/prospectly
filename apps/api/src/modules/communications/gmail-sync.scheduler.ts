import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { isDuplicateJobError, replaceFinishedDurableJob } from '../../common/workers/durable-job';
import {
  GMAIL_SWEEP_EVERY_MS,
  GMAIL_SYNC_QUEUE,
  SWEEP_GMAIL_CONNECTIONS_BOOT_JOB_ID,
  SWEEP_GMAIL_CONNECTIONS_JOB,
} from './communications.constants';

@Injectable()
export class GmailSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(GmailSyncScheduler.name);

  constructor(@InjectQueue(GMAIL_SYNC_QUEUE) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    const bootExisting = await this.queue.getJob(SWEEP_GMAIL_CONNECTIONS_BOOT_JOB_ID);
    if ((await replaceFinishedDurableJob(bootExisting)) !== 'busy') {
      try {
        await this.queue.add(
          SWEEP_GMAIL_CONNECTIONS_JOB,
          {},
          {
            jobId: SWEEP_GMAIL_CONNECTIONS_BOOT_JOB_ID,
            removeOnComplete: 20,
            removeOnFail: 50,
          },
        );
      } catch (error) {
        if (!isDuplicateJobError(error)) throw error;
      }
    }
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
    this.logger.log('Gmail sync sweep registered (boot + 15m)');
  }
}
