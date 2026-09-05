import { randomUUID } from 'node:crypto';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import {
  isDuplicateJobError,
  OUTBOX_JOB_STALE_MS,
  staleBefore,
} from '../../common/workers/durable-job';
import { MetricsService } from '../ops/metrics.service';
import {
  LEAD_AGGREGATE_TYPE,
  LEAD_CREATED_SCHEMA_VERSION,
  LEAD_CREATED_TYPE,
  LEAD_STAGE_CHANGED_SCHEMA_VERSION,
  LEAD_STAGE_CHANGED_TYPE,
  OUTBOX_JOB_OPTIONS,
  OUTBOX_MAX_ATTEMPTS,
  OUTBOX_PROCESSING_STALE_MS,
  OUTBOX_QUEUE,
  OUTBOX_RETAIN_DAYS,
  PUBLISH_OUTBOX_JOB,
  outboxJobId,
  type LeadCreatedPayload,
  type LeadStageChangedPayload,
  type PublishOutboxJobData,
} from './outbox.constants';

export type AppendLeadStageChangedInput = {
  organizationId: string;
  leadId: string;
  actorId: string;
  correlationId?: string;
  payload: LeadStageChangedPayload;
};

export type AppendLeadCreatedInput = {
  organizationId: string;
  leadId: string;
  actorId: string;
  correlationId?: string;
  payload: LeadCreatedPayload;
};

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue<PublishOutboxJobData>,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async appendLeadStageChanged(tx: Prisma.TransactionClient, input: AppendLeadStageChangedInput) {
    const id = randomUUID();
    const retainUntil = new Date(Date.now() + OUTBOX_RETAIN_DAYS * 24 * 60 * 60 * 1000);
    return tx.outboxEvent.create({
      data: {
        id,
        organizationId: input.organizationId,
        type: LEAD_STAGE_CHANGED_TYPE,
        schemaVersion: LEAD_STAGE_CHANGED_SCHEMA_VERSION,
        aggregateType: LEAD_AGGREGATE_TYPE,
        aggregateId: input.leadId,
        actorId: input.actorId,
        correlationId: input.correlationId ?? null,
        idempotencyKey: `${LEAD_STAGE_CHANGED_TYPE}:${input.leadId}:${input.payload.fromStageId ?? 'none'}:${input.payload.toStageId}:${id}`,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        retainUntil,
      },
    });
  }

  async appendLeadCreated(tx: Prisma.TransactionClient, input: AppendLeadCreatedInput) {
    const id = randomUUID();
    const retainUntil = new Date(Date.now() + OUTBOX_RETAIN_DAYS * 24 * 60 * 60 * 1000);
    return tx.outboxEvent.create({
      data: {
        id,
        organizationId: input.organizationId,
        type: LEAD_CREATED_TYPE,
        schemaVersion: LEAD_CREATED_SCHEMA_VERSION,
        aggregateType: LEAD_AGGREGATE_TYPE,
        aggregateId: input.leadId,
        actorId: input.actorId,
        correlationId: input.correlationId ?? null,
        idempotencyKey: `${LEAD_CREATED_TYPE}:${input.leadId}`,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        retainUntil,
      },
    });
  }

  async dispatch(event: {
    id: string;
    organizationId: string;
    correlationId?: string | null;
  }): Promise<void> {
    try {
      await this.queue.add(
        PUBLISH_OUTBOX_JOB,
        {
          eventId: event.id,
          organizationId: event.organizationId,
          ...(event.correlationId ? { correlationId: event.correlationId } : {}),
        },
        { ...OUTBOX_JOB_OPTIONS, jobId: outboxJobId(event.id) },
      );
    } catch (error) {
      if (!isDuplicateJobError(error)) {
        this.logger.warn({
          message: 'Outbox dispatch deferred',
          eventId: event.id,
          organizationId: event.organizationId,
          correlationId: event.correlationId ?? undefined,
        });
        throw error;
      }
    }
    await this.prisma.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
      },
      data: { jobDispatchedAt: new Date() },
    });
  }

  async reconcilePending(): Promise<number> {
    return runWithBypass(async () => {
      const stale = staleBefore(OUTBOX_JOB_STALE_MS);
      const pending = await this.prisma.outboxEvent.findMany({
        where: {
          status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
          attempts: { lt: OUTBOX_MAX_ATTEMPTS },
          OR: [{ jobDispatchedAt: null }, { jobDispatchedAt: { lt: stale } }],
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { id: true, organizationId: true, correlationId: true, jobDispatchedAt: true },
      });
      let dispatched = 0;
      for (const event of pending) {
        try {
          const recovered = Boolean(event.jobDispatchedAt);
          await this.dispatch(event);
          if (recovered) {
            this.metrics?.recordJobRecovered();
          }
          dispatched += 1;
        } catch {
          // Redis still down; the next pass retries the PENDING/FAILED row.
        }
      }
      return dispatched;
    });
  }

  async process(eventId: string): Promise<void> {
    const staleBeforeDate = new Date(Date.now() - OUTBOX_PROCESSING_STALE_MS);
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: {
        id: eventId,
        OR: [
          {
            status: { in: [OutboxEventStatus.PENDING, OutboxEventStatus.FAILED] },
            attempts: { lt: OUTBOX_MAX_ATTEMPTS },
          },
          {
            status: OutboxEventStatus.PROCESSING,
            updatedAt: { lt: staleBeforeDate },
          },
        ],
      },
      data: {
        status: OutboxEventStatus.PROCESSING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count !== 1) {
      return;
    }

    const event = await this.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event) {
      return;
    }

    this.logger.log({
      message: 'Outbox event processing started',
      eventId,
      type: event.type,
      organizationId: event.organizationId,
      correlationId: event.correlationId,
      attempts: event.attempts,
      status: event.status,
    });

    try {
      this.assertPayload(event.type, event.payload);
      await this.prisma.outboxEvent.updateMany({
        where: { id: eventId },
        data: {
          status: OutboxEventStatus.PROCESSED,
          processedAt: new Date(),
          failedAt: null,
          lastError: null,
        },
      });
      this.logger.log({
        message: 'Outbox event processed',
        eventId,
        type: event.type,
        organizationId: event.organizationId,
        correlationId: event.correlationId,
        attempts: event.attempts,
        status: OutboxEventStatus.PROCESSED,
      });
    } catch (error) {
      const dead = event.attempts >= OUTBOX_MAX_ATTEMPTS;
      const status = dead ? OutboxEventStatus.DEAD : OutboxEventStatus.FAILED;
      await this.prisma.outboxEvent.updateMany({
        where: { id: eventId },
        data: {
          status,
          failedAt: new Date(),
          lastError: this.sanitizeError(error),
        },
      });
      this.logger.warn({
        message: 'Outbox event processing failed',
        eventId,
        type: event.type,
        organizationId: event.organizationId,
        correlationId: event.correlationId,
        attempts: event.attempts,
        status,
      });
      throw error;
    }
  }

  private assertPayload(type: string, payload: Prisma.JsonValue): void {
    if (type === LEAD_STAGE_CHANGED_TYPE) {
      this.assertLeadStageChangedPayload(payload);
      return;
    }
    if (type === LEAD_CREATED_TYPE) {
      this.assertLeadCreatedPayload(payload);
      return;
    }
    throw new Error('Unknown outbox event type');
  }

  private assertLeadCreatedPayload(payload: Prisma.JsonValue): LeadCreatedPayload {
    const record = this.assertObjectPayload(payload);
    if (typeof record.leadId !== 'string' || typeof record.source !== 'string') {
      throw new Error('Invalid outbox payload');
    }
    return {
      leadId: record.leadId,
      source: record.source,
      ownerId: typeof record.ownerId === 'string' ? record.ownerId : null,
      stageId: typeof record.stageId === 'string' ? record.stageId : null,
    };
  }

  private assertLeadStageChangedPayload(payload: Prisma.JsonValue): LeadStageChangedPayload {
    const record = this.assertObjectPayload(payload);
    if (typeof record.leadId !== 'string' || typeof record.toStageId !== 'string') {
      throw new Error('Invalid outbox payload');
    }
    return {
      leadId: record.leadId,
      fromStageId: typeof record.fromStageId === 'string' ? record.fromStageId : null,
      toStageId: record.toStageId,
      fromStageName: typeof record.fromStageName === 'string' ? record.fromStageName : null,
      toStageName: typeof record.toStageName === 'string' ? record.toStageName : '',
    };
  }

  private assertObjectPayload(payload: Prisma.JsonValue): Record<string, unknown> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid outbox payload');
    }
    const record = payload as Record<string, unknown>;
    if ('email' in record || 'phone' in record || 'whatsapp' in record) {
      throw new Error('Outbox payload must not include contact PII');
    }
    return record;
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 500);
  }
}
