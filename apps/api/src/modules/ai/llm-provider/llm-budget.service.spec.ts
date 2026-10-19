import { ConfigService } from '@nestjs/config';
import { AiRunStatus } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { LlmBudgetService } from './llm-budget.service';
import { AiBudgetExceededException, AiProviderUnavailableException } from './llm-provider.types';

describe('LlmBudgetService', () => {
  let service: LlmBudgetService;
  let configService: ConfigService;
  let prismaMock: {
    aiRun: {
      aggregate: jest.Mock;
    };
  };

  function setup(dailyLimit = 100_000) {
    configService = {
      get: jest.fn().mockReturnValue(dailyLimit),
    } as unknown as ConfigService;

    prismaMock = {
      aiRun: {
        aggregate: jest.fn(),
      },
    };

    service = new LlmBudgetService(configService, prismaMock as unknown as PrismaService);
  }

  it('allows execution when token usage is below daily limit', async () => {
    setup(50_000);
    prismaMock.aiRun.aggregate.mockResolvedValueOnce({
      _sum: { inputTokens: 10_000, outputTokens: 5_000 },
    });

    const result = await service.checkBudget('org-1');
    expect(result.usedTokens).toBe(15_000);
    expect(result.limitTokens).toBe(50_000);
  });

  it('throws AiBudgetExceededException when token usage reaches or exceeds limit', async () => {
    setup(50_000);
    prismaMock.aiRun.aggregate.mockResolvedValueOnce({
      _sum: { inputTokens: 40_000, outputTokens: 10_000 },
    });

    await expect(service.checkBudget('org-1')).rejects.toThrow(AiBudgetExceededException);
  });

  it('allows unlimited usage when daily budget is 0 or negative', async () => {
    setup(0);

    const result = await service.checkBudget('org-1');
    expect(result.limitTokens).toBe(0);
    expect(prismaMock.aiRun.aggregate).not.toHaveBeenCalled();
  });

  it('fails closed and throws AiProviderUnavailableException on DB error', async () => {
    setup(50_000);
    prismaMock.aiRun.aggregate.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(service.checkBudget('org-1')).rejects.toThrow(AiProviderUnavailableException);
  });

  it('queries both COMPLETED and FAILED runs to account for partial consumption from interrupted streams', async () => {
    setup(50_000);
    prismaMock.aiRun.aggregate.mockResolvedValueOnce({
      _sum: { inputTokens: 5_000, outputTokens: 2_000 },
    });

    await service.checkBudget('org-1');
    expect(prismaMock.aiRun.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: [AiRunStatus.COMPLETED, AiRunStatus.FAILED] },
        }),
      }),
    );
  });
});
