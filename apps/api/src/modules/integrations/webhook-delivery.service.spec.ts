import { createHmac } from 'node:crypto';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { WEBHOOK_PROVIDER } from './integrations.service';
import { encryptWebhookSigningSecret } from './webhook-secret-crypto';
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

const KEY = 'aa'.repeat(32);
const NOW_MS = 1_700_000_000_000;

const makeConfig = () => ({ get: (key: string) => (key === 'google.tokenEncryptionKey' ? KEY : '') });

const makePrisma = () => ({
  integration: {
    findUnique: jest.fn(),
  },
});

describe('WebhookDeliveryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    fetchWithPinnedDns.mockResolvedValue({
      status: 200,
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips delivery when webhook integration is missing or disabled', async () => {
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue(null);
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService, makeConfig() as never);

    const result = await service.deliverOutboxEvent(makeEvent());

    expect(result).toEqual({ delivered: false, reason: 'no_active_webhook' });
    expect(fetchWithPinnedDns).not.toHaveBeenCalled();

    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'DISABLED',
      config: { url: 'https://hooks.example.com/prospectly' },
    });
    const disabled = await service.deliverOutboxEvent(makeEvent());
    expect(disabled).toEqual({ delivered: false, reason: 'no_active_webhook' });
    expect(fetchWithPinnedDns).not.toHaveBeenCalled();
  });

  it('skips delivery when enabled webhook has no URL', async () => {
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: { url: '  ' },
    });
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService, makeConfig() as never);

    const result = await service.deliverOutboxEvent(makeEvent());

    expect(result).toEqual({ delivered: false, reason: 'missing_url' });
    expect(fetchWithPinnedDns).not.toHaveBeenCalled();
  });

  it('posts unsigned when the tenant has no signing secret yet', async () => {
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: { url: 'https://hooks.example.com/prospectly' },
    });
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService, makeConfig() as never);

    const result = await service.deliverOutboxEvent(makeEvent());

    expect(result).toEqual({ delivered: true });
    const headers = fetchWithPinnedDns.mock.calls[0][2].headers as Record<string, string>;
    expect(headers['X-Prospectly-Event-Id']).toBe('evt-1');
    expect(headers['X-Prospectly-Event-Type']).toBe('lead.stage_changed');
    expect(headers['X-Prospectly-Signature']).toBeUndefined();
  });

  it('posts HMAC t,v1 when a signing secret exists', async () => {
    const secret = 'plwhsec_known_secret_for_mac';
    const ciphertext = encryptWebhookSigningSecret(secret, KEY, 'org-1');
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: { url: 'https://hooks.example.com/prospectly', signingSecretCiphertext: ciphertext },
    });
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService, makeConfig() as never);

    const result = await service.deliverOutboxEvent(makeEvent());

    expect(result).toEqual({ delivered: true });
    const init = fetchWithPinnedDns.mock.calls[0][2] as { headers: Record<string, string>; body: string };
    const t = Math.floor(NOW_MS / 1000);
    const expectedMac = createHmac('sha256', secret).update(`${t}.${init.body}`, 'utf8').digest('hex');
    expect(init.headers['X-Prospectly-Signature']).toBe(`t=${t},v1=${expectedMac}`);
    expect(init.body).toContain('"leadId":"lead-1"');
  });

  it('does not verify after rotate with the previous secret', async () => {
    const oldSecret = 'plwhsec_old';
    const newSecret = 'plwhsec_new';
    const prisma = makePrisma();
    prisma.integration.findUnique.mockResolvedValue({
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: {
        url: 'https://hooks.example.com/prospectly',
        signingSecretCiphertext: encryptWebhookSigningSecret(newSecret, KEY, 'org-1'),
      },
    });
    const service = new WebhookDeliveryService(prisma as unknown as PrismaService, makeConfig() as never);

    await service.deliverOutboxEvent(makeEvent());
    const init = fetchWithPinnedDns.mock.calls[0][2] as { headers: Record<string, string>; body: string };
    const t = Math.floor(NOW_MS / 1000);
    const oldMac = createHmac('sha256', oldSecret).update(`${t}.${init.body}`, 'utf8').digest('hex');
    const newMac = createHmac('sha256', newSecret).update(`${t}.${init.body}`, 'utf8').digest('hex');
    expect(init.headers['X-Prospectly-Signature']).toBe(`t=${t},v1=${newMac}`);
    expect(init.headers['X-Prospectly-Signature']).not.toBe(`t=${t},v1=${oldMac}`);
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
    const service = new WebhookDeliveryService(
      prisma as unknown as PrismaService,
      makeConfig() as never,
      metrics as never,
    );

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
