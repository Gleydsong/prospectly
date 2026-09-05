import type { PrismaService } from '../../common/prisma/prisma.service';
import { WEBHOOK_PROVIDER } from './integrations.service';
import { WebhookDeliveryService } from './webhook-delivery.service';

jest.mock('../website-analysis/ssrf', () => ({
  assertSafePublicUrl: jest.fn(async (url: string) => ({
    url: new URL(url),
    addresses: ['93.184.216.34'],
  })),
  fetchWithPinnedDns: jest.fn(),
  SsrfBlockedError: class SsrfBlockedError extends Error {
    name = 'SsrfBlockedError';
  },
}));

const { fetchWithPinnedDns } = jest.requireMock('../website-analysis/ssrf') as {
  fetchWithPinnedDns: jest.Mock;
};

const makePrisma = () => ({
  integration: {
    findUnique: jest.fn(),
  },
});

describe('WebhookDeliveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchWithPinnedDns.mockResolvedValue({
      status: 200,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    });
  });

  it('skips delivery when webhook integration is missing or disabled', async () => {
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue(null);
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService);

    const result = await service.deliverOutboxEvent(makeEvent());

    expect(result).toEqual({ delivered: false, reason: 'no_active_webhook' });
    expect(fetchWithPinnedDns).not.toHaveBeenCalled();
  });

  it('posts lead.stage_changed envelope to the configured webhook URL', async () => {
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: { url: 'https://hooks.example.com/prospectly' },
    });
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService);

    const result = await service.deliverOutboxEvent(makeEvent());

    expect(result).toEqual({ delivered: true });
    expect(prisma.integration.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_provider: {
          organizationId: 'org-1',
          provider: WEBHOOK_PROVIDER,
        },
      },
    });
    expect(fetchWithPinnedDns).toHaveBeenCalledWith(
      'https://hooks.example.com/prospectly',
      ['93.184.216.34'],
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Prospectly-Event-Id': 'evt-1',
          'X-Prospectly-Event-Type': 'lead.stage_changed',
        }),
        body: expect.stringContaining('"leadId":"lead-1"'),
      }),
    );
  });

  it('fails when webhook responds with non-2xx', async () => {
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: { url: 'https://hooks.example.com/prospectly' },
    });
    fetchWithPinnedDns.mockResolvedValue({
      status: 500,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    });
    const metrics = { recordWebhookProcessed: jest.fn(), recordWebhookFailed: jest.fn() };
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService, metrics as never);

    await expect(service.deliverOutboxEvent(makeEvent())).rejects.toThrow(/HTTP 500/);
    expect(metrics.recordWebhookFailed).toHaveBeenCalled();
  });
});

function makeEvent() {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    type: 'lead.stage_changed',
    schemaVersion: 1,
    correlationId: 'corr-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    payload: {
      leadId: 'lead-1',
      fromStageId: 'stage-a',
      toStageId: 'stage-b',
      fromStageName: 'A',
      toStageName: 'B',
    },
  };
}
