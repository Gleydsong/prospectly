import { Injectable, Logger } from '@nestjs/common';
import { AiRunStatus } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  AiException,
  AiProviderUnavailableException,
  LlmCallContext,
  LlmUsage,
} from './llm-provider.types';

@Injectable()
export class LlmTelemetryService {
  private readonly logger = new Logger(LlmTelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async startRun(context: LlmCallContext, provider: string, model: string): Promise<string> {
    if (!context.organizationId) {
      throw new AiException(
        'Organization ID is required for AI telemetry',
        'AI_ORGANIZATION_REQUIRED',
      );
    }

    let userId = context.userId;
    const clientWithMember = this.prisma as unknown as {
      organizationMember?: {
        findFirst?: (args: {
          where: { organizationId: string };
          select: { userId: true };
        }) => Promise<{ userId?: string } | null>;
      };
    };
    if (!userId && clientWithMember.organizationMember?.findFirst) {
      try {
        const member = await clientWithMember.organizationMember.findFirst({
          where: { organizationId: context.organizationId },
          select: { userId: true },
        });
        if (member?.userId) {
          userId = member.userId;
        }
      } catch (err) {
        this.logger.warn({
          message: 'Failed to resolve organization member for AI telemetry',
          organizationId: context.organizationId,
          error: err instanceof Error ? err.name : 'UnknownError',
        });
      }
    }

    if (!userId) {
      this.logger.error({
        message: 'Cannot record AiRun: missing userId for organization; failing closed',
        organizationId: context.organizationId,
        task: context.task,
      });
      throw new AiException(
        'User ID is required for AI telemetry and budget tracking',
        'AI_USER_REQUIRED',
      );
    }

    try {
      const record = await this.prisma.aiRun.create({
        data: {
          organizationId: context.organizationId,
          userId,
          opportunityRunId: context.opportunityRunId ?? null,
          candidateId: context.candidateId ?? null,
          task: context.task ?? 'LLM_COMPLETION',
          provider,
          model,
          promptVersion: context.promptVersion ?? 'v1',
          status: AiRunStatus.PENDING,
        },
      });
      return record.id;
    } catch (error) {
      this.logger.error({
        message: 'Could not record AiRun start in database; failing closed',
        task: context.task,
        organizationId: context.organizationId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new AiProviderUnavailableException(
        `Failed to record AI run start in database: ${error instanceof Error ? error.name : 'UnknownError'}`,
        'database',
        error instanceof Error ? new Error(error.name) : undefined,
      );
    }
  }

  async completeRun(params: {
    runId: string | null;
    provider: string;
    model: string;
    usage: LlmUsage;
    durationMs: number;
    fallbackUsed: boolean;
    task?: string;
  }): Promise<void> {
    // Audit log without any prompt/output content (LGPD & security compliance)
    this.logger.log({
      message: 'LLM completion completed successfully',
      provider: params.provider,
      model: params.model,
      durationMs: params.durationMs,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
      fallbackUsed: params.fallbackUsed,
      task: params.task,
    });

    if (!params.runId) return;

    try {
      await this.prisma.aiRun.update({
        where: { id: params.runId },
        data: {
          status: AiRunStatus.COMPLETED,
          provider: params.provider,
          model: params.model,
          inputTokens: params.usage.promptTokens,
          outputTokens: params.usage.completionTokens,
          durationMs: params.durationMs,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn({
        message: 'Could not update AiRun completion in database',
        runId: params.runId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  async failRun(params: {
    runId: string | null;
    provider: string;
    model: string;
    errorCode: string;
    durationMs: number;
    fallbackUsed: boolean;
    task?: string;
    usage?: LlmUsage;
  }): Promise<void> {
    // Audit log failure without any sensitive content
    this.logger.warn({
      message: 'LLM completion failed',
      provider: params.provider,
      model: params.model,
      errorCode: params.errorCode,
      durationMs: params.durationMs,
      promptTokens: params.usage?.promptTokens,
      completionTokens: params.usage?.completionTokens,
      totalTokens: params.usage?.totalTokens,
      fallbackUsed: params.fallbackUsed,
      task: params.task,
    });

    if (!params.runId) return;

    try {
      await this.prisma.aiRun.update({
        where: { id: params.runId },
        data: {
          status: AiRunStatus.FAILED,
          provider: params.provider,
          model: params.model,
          errorCode: params.errorCode.slice(0, 80),
          durationMs: params.durationMs,
          inputTokens: params.usage ? params.usage.promptTokens : undefined,
          outputTokens: params.usage ? params.usage.completionTokens : undefined,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn({
        message: 'Could not update AiRun failure in database',
        runId: params.runId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }
}
