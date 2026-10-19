import { Logger } from '@nestjs/common';
import { AiRunStatus } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { LlmTelemetryService } from './llm-telemetry.service';

describe('LlmTelemetryService', () => {
  let service: LlmTelemetryService;
  let prismaMock: {
    aiRun: {
      create: jest.Mock;
      update: jest.Mock;
    };
    organizationMember?: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    prismaMock = {
      aiRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({ id: 'run-1' }),
      },
    };
    service = new LlmTelemetryService(prismaMock as unknown as PrismaService);
  });

  it('starts run when organizationId and userId are provided', async () => {
    const runId = await service.startRun(
      {
        organizationId: 'org-1',
        userId: 'user-1',
        task: 'OPPORTUNITY_EXPLANATION',
      },
      'cloudflare',
      '@cf/openai/gpt-oss-120b',
    );

    expect(runId).toBe('run-1');
    expect(prismaMock.aiRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'user-1',
          provider: 'cloudflare',
          model: '@cf/openai/gpt-oss-120b',
          status: AiRunStatus.PENDING,
        }),
      }),
    );
  });

  it('throws AiException when userId is missing and cannot be resolved', async () => {
    await expect(
      service.startRun(
        {
          organizationId: 'org-1',
        },
        'cloudflare',
        '@cf/openai/gpt-oss-120b',
      ),
    ).rejects.toThrow();
    expect(prismaMock.aiRun.create).not.toHaveBeenCalled();
  });

  it('resolves userId from organizationMember when omitted in context', async () => {
    prismaMock.organizationMember = {
      findFirst: jest.fn().mockResolvedValue({ userId: 'member-user-1' }),
    };

    const runId = await service.startRun(
      {
        organizationId: 'org-1',
      },
      'cloudflare',
      '@cf/openai/gpt-oss-120b',
    );

    expect(runId).toBe('run-1');
    expect(prismaMock.aiRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          userId: 'member-user-1',
        }),
      }),
    );
  });

  it('fails closed and throws AiProviderUnavailableException when DB create fails', async () => {
    prismaMock.aiRun.create.mockRejectedValueOnce(new Error('DB write failure'));

    await expect(
      service.startRun(
        {
          organizationId: 'org-1',
          userId: 'user-1',
        },
        'cloudflare',
        '@cf/openai/gpt-oss-120b',
      ),
    ).rejects.toThrow();
  });

  it('does not log raw member lookup errors and fails closed', async () => {
    const sentinel = 'QA_MEMBER_PRIVATE_SENTINEL';
    prismaMock.organizationMember = {
      findFirst: jest.fn().mockRejectedValue(new Error(sentinel)),
    };
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      await expect(
        service.startRun({ organizationId: 'org-1' }, 'cloudflare', 'model'),
      ).rejects.toThrow();
      expect(prismaMock.aiRun.create).not.toHaveBeenCalled();
      expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain(sentinel);
      expect(warn).toHaveBeenCalledWith(expect.objectContaining({ error: 'Error' }));
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('updates run on completion', async () => {
    await service.completeRun({
      runId: 'run-1',
      provider: 'cloudflare',
      model: '@cf/openai/gpt-oss-120b',
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      durationMs: 150,
      fallbackUsed: false,
    });

    expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: AiRunStatus.COMPLETED,
          inputTokens: 10,
          outputTokens: 20,
          durationMs: 150,
        }),
      }),
    );
  });

  it('updates run on failure with sliced error code', async () => {
    await service.failRun({
      runId: 'run-1',
      provider: 'cloudflare',
      model: '@cf/openai/gpt-oss-120b',
      errorCode: 'AI_TIMEOUT',
      durationMs: 30000,
      fallbackUsed: false,
    });

    expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: AiRunStatus.FAILED,
          errorCode: 'AI_TIMEOUT',
          durationMs: 30000,
        }),
      }),
    );
  });

  it('updates run on failure with partial token usage when provided', async () => {
    await service.failRun({
      runId: 'run-1',
      provider: 'cloudflare',
      model: '@cf/openai/gpt-oss-120b',
      errorCode: 'STREAM_ABORTED',
      durationMs: 500,
      fallbackUsed: false,
      usage: { promptTokens: 70, completionTokens: 30, totalTokens: 100 },
    });

    expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: AiRunStatus.FAILED,
          errorCode: 'STREAM_ABORTED',
          inputTokens: 70,
          outputTokens: 30,
          durationMs: 500,
        }),
      }),
    );
  });
});
