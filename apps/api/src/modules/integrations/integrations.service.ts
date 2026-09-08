import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { assertSafePublicUrl, SsrfBlockedError } from '../website-analysis/ssrf';
import { CreateWebhookIntegrationDto } from './dto/create-webhook-integration.dto';
import { encryptWebhookSigningSecret } from './webhook-secret-crypto';
import { generateWebhookSigningSecret } from './webhook-signature';

export const WEBHOOK_PROVIDER = 'WEBHOOK';
export const WEBHOOK_DELIVERIES_PAGE_SIZE = 50;

type WebhookConfig = {
  url: string;
  label?: string;
  signingSecretCiphertext?: string;
};

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(organizationId: string) {
    const rows = await this.prisma.integration.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.serialize(row));
  }

  async upsertWebhook(organizationId: string, userId: string, dto: CreateWebhookIntegrationDto) {
    const url = dto.url.trim();
    this.assertWebhookScheme(url);

    try {
      await assertSafePublicUrl(url);
    } catch (error) {
      if (error instanceof SsrfBlockedError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const existing = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: WEBHOOK_PROVIDER },
      },
    });
    const existingConfig = (existing?.config ?? {}) as Partial<WebhookConfig>;
    const existingCipher =
      typeof existingConfig.signingSecretCiphertext === 'string'
        ? existingConfig.signingSecretCiphertext
        : '';

    let issuedSecret: string | undefined;
    let ciphertext = existingCipher;
    if (!ciphertext) {
      issuedSecret = generateWebhookSigningSecret();
      ciphertext = encryptWebhookSigningSecret(
        issuedSecret,
        this.requireEncryptionKey(),
        organizationId,
      );
    }

    const config: WebhookConfig = {
      url,
      signingSecretCiphertext: ciphertext,
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

    return this.serialize(row, issuedSecret);
  }

  async rotateWebhookSecret(organizationId: string, userId: string) {
    const existing = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: WEBHOOK_PROVIDER },
      },
    });
    if (!existing) {
      throw new NotFoundException('Webhook not found');
    }

    const existingConfig = (existing.config ?? {}) as Partial<WebhookConfig>;
    const url = typeof existingConfig.url === 'string' ? existingConfig.url : '';
    const issuedSecret = generateWebhookSigningSecret();
    const ciphertext = encryptWebhookSigningSecret(
      issuedSecret,
      this.requireEncryptionKey(),
      organizationId,
    );
    const config: WebhookConfig = {
      url,
      signingSecretCiphertext: ciphertext,
      ...(typeof existingConfig.label === 'string' && existingConfig.label
        ? { label: existingConfig.label }
        : {}),
    };

    const row = await this.prisma.integration.update({
      where: { id: existing.id },
      data: { config: config as Prisma.InputJsonValue },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'integration.webhook.rotate',
        entity: 'Integration',
        entityId: row.id,
        metadata: {
          provider: WEBHOOK_PROVIDER,
          status: row.status,
          host: url ? safeHost(url) : null,
        },
      },
    });

    return this.serialize(row, issuedSecret);
  }

  async listDeliveries(organizationId: string) {
    const rows = await this.prisma.outboxEvent.findMany({
      where: {
        organizationId,
        retainUntil: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: WEBHOOK_DELIVERIES_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        createdAt: true,
        status: true,
        attempts: true,
        lastError: true,
        skipReason: true,
        processedAt: true,
      },
    });

    return rows;
  }

  private serialize(
    row: {
      id: string;
      organizationId: string;
      provider: string;
      status: string;
      config: Prisma.JsonValue | null;
      createdAt: Date;
      updatedAt: Date;
    },
    issuedSecret?: string,
  ) {
    const config = (row.config ?? {}) as Partial<WebhookConfig>;
    const ciphertext =
      typeof config.signingSecretCiphertext === 'string' ? config.signingSecretCiphertext : '';
    return {
      id: row.id,
      provider: row.provider,
      status: row.status,
      url: typeof config.url === 'string' ? config.url : null,
      label: typeof config.label === 'string' ? config.label : null,
      hasSigningSecret: ciphertext.length > 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      ...(issuedSecret ? { signingSecret: issuedSecret } : {}),
    };
  }

  private assertWebhookScheme(url: string) {
    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      throw new BadRequestException('Webhook URL must use http or https');
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Webhook URL is invalid');
    }
    if (parsed.protocol === 'https:') return;
    const host = parsed.hostname.toLowerCase();
    const loopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (parsed.protocol === 'http:' && loopback) return;
    throw new BadRequestException('Webhook URL must use https');
  }

  private requireEncryptionKey(): string {
    const key = this.config.get<string>('google.tokenEncryptionKey')?.trim() ?? '';
    if (!key) {
      throw new ServiceUnavailableException('Webhook signing secret encryption is not configured');
    }
    return key;
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

