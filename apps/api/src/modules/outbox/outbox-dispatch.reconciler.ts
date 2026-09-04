import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

import { OutboxService } from './outbox.service';

export class OutboxDispatchReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatchReconciler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly outbox: OutboxService,
    private readonly intervalMs = 5_000,
  ) {}

  onApplicationBootstrap(): void {
    void this.run();
    this.timer = setInterval(() => void this.run(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    try {
      await this.outbox.reconcilePending();
    } catch {
      this.logger.warn({ message: 'Outbox dispatch reconciliation failed' });
    }
  }
}
