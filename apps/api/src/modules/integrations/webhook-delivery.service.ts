import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertSafePublicUrl,
  fetchWithPinnedDns,
  SsrfBlockedError,
} from '../website-analysis/ssrf';
import { MetricsService } from '../ops/metrics.service';
import { WEBHOOK_PROVIDER } from './integrations.service';
import type {
  LeadCreatedPayload,
  LeadDoNotContactSetPayload,
  LeadStageChangedPayload,
  TaskCompletedPayload,
} from '../outbox/outbox.constants';
import { decryptWebhookSigningSecret } from './webhook-secret-crypto';
import {
  WEBHOOK_SIGNATURE_HEADER,
  buildWebhookSignatureHeader,
} from './webhook-signature';

const WEBHOOK_USER_AGENT = 'Prospectly-Webhook/1';
const WEBHOOK_TIMEOUT_MS = 15_000;

type WebhookConfig = {
  url: string;
  label?: string;
  signingSecretCiphertext?: string;
};

export type DeliverOutboxEventInput = {
  id: string;
  organizationId: string;
  type: string;
  schemaVersion: number;
  correlationId: string | null;
  createdAt: Date;
  payload:
    | LeadStageChangedPayload
    | LeadCreatedPayload
    | LeadDoNotContactSetPayload
    | TaskCompletedPayload;
};

export type WebhookDeliveryResult =
  { delivered: true } | { delivered: false; reason: 'no_active_webhook' | 'missing_url' };

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async deliverOutboxEvent(event: DeliverOutboxEventInput): Promise<WebhookDeliveryResult> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        organizationId_provider: {
          organizationId: event.organizationId,
          provider: WEBHOOK_PROVIDER,
        },
      },
    });

    if (!integration || integration.status !== 'ENABLED') {
      return { delivered: false, reason: 'no_active_webhook' };
    }

    const config = (integration.config ?? {}) as Partial<WebhookConfig>;
    const url = typeof config.url === 'string' ? config.url.trim() : '';
    if (!url) {
      return { delivered: false, reason: 'missing_url' };
    }

    const body = JSON.stringify({
      type: event.type,
      schemaVersion: event.schemaVersion,
      eventId: event.id,
      organizationId: event.organizationId,
      correlationId: event.correlationId,
      occurredAt: event.createdAt.toISOString(),
      data: event.payload,
    });

    const signingSecret = this.decryptSigningSecret(config, event.organizationId);

    try {
      await this.postJson(url, body, {
        eventId: event.id,
        eventType: event.type,
        organizationId: event.organizationId,
        signingSecret,
      });
      this.metrics?.recordWebhookProcessed();
      return { delivered: true };
    } catch (error) {
      this.metrics?.recordWebhookFailed();
      throw error;
    }
  }

  private decryptSigningSecret(
    config: Partial<WebhookConfig>,
    organizationId: string,
  ): string | null {
    const ciphertext =
      typeof config.signingSecretCiphertext === 'string' ? config.signingSecretCiphertext.trim() : '';
    if (!ciphertext) return null;
    const key = this.config.get<string>('google.tokenEncryptionKey')?.trim() ?? '';
    if (!key) {
      throw new Error('Webhook signing secret encryption is not configured');
    }
    return decryptWebhookSigningSecret(ciphertext, key, organizationId);
  }

  private async postJson(
    url: string,
    body: string,
    context: {
      eventId: string;
      eventType: string;
      organizationId: string;
      signingSecret: string | null;
    },
  ): Promise<void> {
    let safe;
    try {
      safe = await assertSafePublicUrl(url);
    } catch (error) {
      if (error instanceof SsrfBlockedError) {
        throw new Error(`Webhook URL blocked: ${error.message}`);
      }
      throw error;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(body)),
      'User-Agent': WEBHOOK_USER_AGENT,
      'X-Prospectly-Event-Id': context.eventId,
      'X-Prospectly-Event-Type': context.eventType,
    };
    if (context.signingSecret) {
      const unixSeconds = Math.floor(Date.now() / 1000);
      headers[WEBHOOK_SIGNATURE_HEADER] = buildWebhookSignatureHeader(
        context.signingSecret,
        body,
        unixSeconds,
      );
    }

    try {
      const response = await fetchWithPinnedDns(safe.url.toString(), safe.addresses, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      try {
        await response.arrayBuffer();
      } catch {
        // Drain best-effort; status already available.
      }

      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Webhook returned HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn({
        message: 'Tenant webhook delivery failed',
        organizationId: context.organizationId,
        eventId: context.eventId,
        eventType: context.eventType,
        error: message.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 500),
      });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
