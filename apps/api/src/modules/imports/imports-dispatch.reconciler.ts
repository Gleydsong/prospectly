import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

import { ImportsService } from './imports.service';

export class ImportsDispatchReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ImportsDispatchReconciler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly imports: ImportsService,
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
      await this.imports.reconcilePending();
    } catch {
      this.logger.warn({ message: 'CSV import dispatch reconciliation failed' });
    }
  }
}
