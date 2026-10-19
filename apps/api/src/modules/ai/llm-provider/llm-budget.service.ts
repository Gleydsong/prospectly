import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiRunStatus } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { AiBudgetExceededException, AiProviderUnavailableException } from './llm-provider.types';

@Injectable()
export class LlmBudgetService {
  private readonly logger = new Logger(LlmBudgetService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getDailyBudgetTokens(): number {
    const raw = this.config.get<number>('ai.dailyBudgetTokens');
    if (raw === undefined || raw === null) return 100_000;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 100_000;
  }

  async getDailyTokenUsage(organizationId: string, now = new Date()): Promise<number> {
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    try {
      const aggregate = await this.prisma.aiRun.aggregate({
        where: {
          organizationId,
          createdAt: { gte: startOfDay },
          status: { in: [AiRunStatus.COMPLETED, AiRunStatus.FAILED] },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
        },
      });

      const input = aggregate._sum.inputTokens ?? 0;
      const output = aggregate._sum.outputTokens ?? 0;
      return input + output;
    } catch (error) {
      this.logger.error({
        message: 'Failed to aggregate daily AI token usage from DB, failing closed',
        organizationId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new AiProviderUnavailableException(
        'Failed to check AI budget due to database error',
        'database',
        error instanceof Error ? new Error(error.name) : undefined,
      );
    }
  }

  async checkBudget(
    organizationId: string,
    now = new Date(),
  ): Promise<{ usedTokens: number; limitTokens: number }> {
    const limitTokens = this.getDailyBudgetTokens();
    if (limitTokens <= 0) {
      // 0 or negative means unlimited budget
      return { usedTokens: 0, limitTokens: 0 };
    }

    const usedTokens = await this.getDailyTokenUsage(organizationId, now);
    if (usedTokens >= limitTokens) {
      throw new AiBudgetExceededException(
        `Daily AI token budget exceeded for organization (${usedTokens}/${limitTokens} tokens used)`,
        organizationId,
        usedTokens,
        limitTokens,
      );
    }

    return { usedTokens, limitTokens };
  }
}
