import { Injectable, Logger, Optional } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  assertSafePublicUrl,
  fetchWithPinnedDns,
  SsrfBlockedError,
} from '../website-analysis/ssrf';
import { MetricsService } from '../ops/metrics.service';
import { WEBHOOK_PROVIDER } from './integrations.service';
import type { LeadCreatedPayload, LeadDoNotContactSetPayload, LeadStageChangedPayload } from '../outbox/outbox.constants';

const WEBHOOK_USER_AGENT = 'Prospectly-Webhook/1';
const WEBHOOK_TIMEOUT_MS = 15_000;

type WebhookConfig = {
  url: string;
  label?: string;
};

export type DeliverOutboxEventInput = {
  id: string;
  organizationId: string;
  type: string;
  schemaVersion: number;
  correlationId: string | null;
  createdAt: Date;
  payload: LeadStageChangedPayload | LeadCreatedPayload | LeadDoNotContactSetPayload;
};

export type WebhookDeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: 'no_active_webhook' | 'missing_url' };

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
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

    try {
      await this.postJson(url, body, {
        eventId: event.id,
        eventType: event.type,
        organizationId: event.organizationId,
      });
      this.metrics?.recordWebhookProcessed();
      return { delivered: true };
    } catch (error) {
      this.metrics?.recordWebhookFailed();
      throw error;
    }
  }

  private async postJson(
    url: string,
    body: string,
    context: { eventId: string; eventType: string; organizationId: string },
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

    try {
      const response = await fetchWithPinnedDns(safe.url.toString(), safe.addresses, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(body)),
          'User-Agent': WEBHOOK_USER_AGENT,
          'X-Prospectly-Event-Id': context.eventId,
          'X-Prospectly-Event-Type': context.eventType,
        },
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
