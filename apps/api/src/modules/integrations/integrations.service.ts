import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateWebhookIntegrationDto } from './dto/create-webhook-integration.dto';

export const WEBHOOK_PROVIDER = 'WEBHOOK';

type WebhookConfig = {
  url: string;
  label?: string;
};

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    const rows = await this.prisma.integration.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async upsertWebhook(organizationId: string, userId: string, dto: CreateWebhookIntegrationDto) {
    const url = dto.url.trim();
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new BadRequestException('Webhook URL must use http or https');
    }

    const config: WebhookConfig = {
      url,
      ...(dto.label?.trim() ? { label: dto.label.trim() } : {}),
    };

    const status = dto.enabled === false ? 'DISABLED' : 'ENABLED';

    const row = await this.prisma.integration.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: WEBHOOK_PROVIDER,
        },
      },
      create: {
        organizationId,
        provider: WEBHOOK_PROVIDER,
        status,
        config: config as Prisma.InputJsonValue,
      },
      update: {
        status,
        config: config as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'integration.webhook.upsert',
        entity: 'Integration',
        entityId: row.id,
        metadata: {
          provider: WEBHOOK_PROVIDER,
          status,
          host: safeHost(url),
        },
      },
    });

    return this.serialize(row);
  }

  private serialize(row: {
    id: string;
    organizationId: string;
    provider: string;
    status: string;
    config: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const config = (row.config ?? {}) as Partial<WebhookConfig>;
    return {
      id: row.id,
      provider: row.provider,
      status: row.status,
      url: typeof config.url === 'string' ? config.url : null,
      label: typeof config.label === 'string' ? config.label : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
