import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_REDACTED_KEY_PATTERN, type AuditAction } from './audit.constants';

export interface AuditLogInput {
  organizationId?: string | null;
  userId?: string | null;
  action: AuditAction | string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          organizationId: input.organizationId ?? null,
          userId: input.userId ?? null,
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          metadata: this.sanitizeMetadata(input.metadata),
          ip: input.ip,
        },
      });
    } catch (error) {
      this.logger.warn({
        message: 'Failed to write audit log',
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  sanitizeMetadata(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
    if (metadata === undefined) {
      return undefined;
    }
    return this.sanitizeValue(metadata, 0) as Prisma.InputJsonValue;
  }

  private sanitizeValue(value: unknown, depth: number): unknown {
    if (depth > 3) {
      return '[truncated]';
    }
    if (value === null || value === undefined) {
      return value ?? null;
    }
    if (typeof value === 'string') {
      return value.length > 200 ? `${value.slice(0, 200)}…` : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
      return '[binary_redacted]';
    }
    if (Array.isArray(value)) {
      return value.slice(0, 20).map((item) => this.sanitizeValue(item, depth + 1));
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (AUDIT_REDACTED_KEY_PATTERN.test(key)) {
          out[key] = '[redacted]';
          continue;
        }
        out[key] = this.sanitizeValue(nested, depth + 1);
      }
      return out;
    }
    return String(value);
  }
}
