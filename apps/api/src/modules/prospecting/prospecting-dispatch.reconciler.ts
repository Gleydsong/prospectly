import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

import { ProspectingService } from './prospecting.service';

export class ProspectingDispatchReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ProspectingDispatchReconciler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prospecting: ProspectingService,
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
      await this.prospecting.reconcilePending();
    } catch {
      this.logger.warn({ message: 'Prospecting dispatch reconciliation failed' });
    }
  }
}
