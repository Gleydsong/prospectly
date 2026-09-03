import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

import { OpportunityFinderService } from './opportunity-finder.service';

export class OpportunityFinderDispatchReconciler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OpportunityFinderDispatchReconciler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly service: OpportunityFinderService,
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
      await this.service.reconcilePending();
    } catch {
      this.logger.warn({ message: 'Opportunity Finder dispatch reconciliation failed' });
    }
  }
}
