import { Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';

import { WebsiteAnalysisService } from './website-analysis.service';

export class WebsiteAnalysisDispatchReconciler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WebsiteAnalysisDispatchReconciler.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly websiteAnalysis: WebsiteAnalysisService,
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
      await this.websiteAnalysis.reconcilePending();
    } catch {
      this.logger.warn({ message: 'Website analysis dispatch reconciliation failed' });
    }
  }
}
