import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { decryptWebhookSigningSecret } from './webhook-secret-crypto';
import { IntegrationsService, WEBHOOK_PROVIDER } from './integrations.service';

jest.mock('../website-analysis/ssrf', () => ({
  assertSafePublicUrl: jest.fn(async (url: string) => ({
    url: new URL(url),
    addresses: ['93.184.216.34'],
  })),
  SsrfBlockedError: class SsrfBlockedError extends Error {
    name = 'SsrfBlockedError';
  },
}));

const KEY = 'aa'.repeat(32);

const makeConfig = (overrides: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    'google.tokenEncryptionKey': KEY,
    ...overrides,
  };
  return { get: (key: string) => values[key] };
};

const webhookRow = (config: Record<string, unknown> = {}) => ({
  id: 'int-1',
  organizationId: 'org-1',
  provider: WEBHOOK_PROVIDER,
  status: 'ENABLED',
  config: { url: 'https://hooks.example.com/x', label: 'CRM', ...config },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
});

const makePrisma = () => {
  const prisma = {
    integration: {
      findMany: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    outboxEvent: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
  return prisma as unknown as PrismaService & {
    integration: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    outboxEvent: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
};

describe('IntegrationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists integrations without signing secret or ciphertext', async () => {
    const prisma = makePrisma();
    prisma.integration.findMany.mockResolvedValue([
      webhookRow({ signingSecretCiphertext: 'iv:tag:cipher' }),
    ]);
    const service = new IntegrationsService(prisma, makeConfig() as never);

    const result = await service.list('org-1');

    expect(prisma.integration.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'int-1',
        provider: WEBHOOK_PROVIDER,
        url: 'https://hooks.example.com/x',
        label: 'CRM',
        status: 'ENABLED',
        hasSigningSecret: true,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('signingSecret');
    expect(JSON.stringify(result)).not.toContain('iv:tag:cipher');
    expect(JSON.stringify(result)).not.toMatch(/plwhsec_/);
  });

  it('issues a signing secret once on first save and never again on URL change', async () => {
    const prisma = makePrisma();
    const service = new IntegrationsService(prisma, makeConfig() as never);
    prisma.integration.upsert.mockImplementation(async ({ create }: { create: { config: unknown } }) =>
      webhookRow(create.config as Record<string, unknown>),
    );

    const first = await service.upsertWebhook('org-1', 'user-1', {
      url: 'https://hooks.example.com/secret?token=abc',
      enabled: true,
    });

    expect(first.signingSecret).toMatch(/^plwhsec_/);
    expect(first.hasSigningSecret).toBe(true);
    const createdConfig = prisma.integration.upsert.mock.calls[0][0].create.config as {
      signingSecretCiphertext: string;
      url: string;
    };
    expect(createdConfig.signingSecretCiphertext).toBeTruthy();
    expect(createdConfig.signingSecretCiphertext).not.toContain(first.signingSecret);
    expect(decryptWebhookSigningSecret(createdConfig.signingSecretCiphertext, KEY, 'org-1')).toBe(
      first.signingSecret,
    );

    prisma.integration.findUnique.mockResolvedValue(
      webhookRow({ signingSecretCiphertext: createdConfig.signingSecretCiphertext }),
    );
    prisma.integration.upsert.mockResolvedValue(
      webhookRow({
        url: 'https://hooks.example.com/renamed',
        signingSecretCiphertext: createdConfig.signingSecretCiphertext,
      }),
    );

    const second = await service.upsertWebhook('org-1', 'user-1', {
      url: 'https://hooks.example.com/renamed',
      enabled: true,
    });
    expect(second).not.toHaveProperty('signingSecret');
    const updatedConfig = prisma.integration.upsert.mock.calls[1][0].update.config as {
      signingSecretCiphertext: string;
      url: string;
    };
    expect(updatedConfig.url).toBe('https://hooks.example.com/renamed');
    expect(updatedConfig.signingSecretCiphertext).toBe(createdConfig.signingSecretCiphertext);
  });

  it('upserts webhook and writes minimal audit metadata without full URL or secret', async () => {
    const prisma = makePrisma();
    prisma.integration.upsert.mockResolvedValue(webhookRow());
    const service = new IntegrationsService(prisma, makeConfig() as never);

    await service.upsertWebhook('org-1', 'user-1', {
      url: 'https://hooks.example.com/secret?token=abc',
      enabled: true,
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'integration.webhook.upsert',
        entity: 'Integration',
        metadata: expect.objectContaining({
          host: 'hooks.example.com',
          provider: WEBHOOK_PROVIDER,
        }),
      }),
    });
    const metadata = prisma.auditLog.create.mock.calls[0][0].data.metadata as Record<string, unknown>;
    expect(JSON.stringify(metadata)).not.toContain('token=abc');
    expect(JSON.stringify(metadata)).not.toMatch(/plwhsec_/);
  });

  it('rotates the signing secret immediately and does not leak it on later list', async () => {
    const prisma = makePrisma();
    const oldCipher = 'aa'.repeat(12) + ':bb:cc';
    prisma.integration.findUnique.mockResolvedValue(webhookRow({ signingSecretCiphertext: oldCipher }));
    prisma.integration.update.mockImplementation(async ({ data }: { data: { config: Record<string, unknown> } }) =>
      webhookRow(data.config),
    );
    const service = new IntegrationsService(prisma, makeConfig() as never);

    const rotated = await service.rotateWebhookSecret('org-1', 'user-1');
    expect(rotated.signingSecret).toMatch(/^plwhsec_/);
    const newCipher = (prisma.integration.update.mock.calls[0][0].data.config as { signingSecretCiphertext: string })
      .signingSecretCiphertext;
    expect(newCipher).not.toBe(oldCipher);
    expect(decryptWebhookSigningSecret(newCipher, KEY, 'org-1')).toBe(rotated.signingSecret);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'integration.webhook.rotate',
        metadata: expect.objectContaining({ host: 'hooks.example.com' }),
      }),
    });
    expect(JSON.stringify(prisma.auditLog.create.mock.calls[0][0].data.metadata)).not.toMatch(/plwhsec_/);

    prisma.integration.findMany.mockResolvedValue([webhookRow({ signingSecretCiphertext: newCipher })]);
    const listed = await service.list('org-1');
    expect(listed[0]).not.toHaveProperty('signingSecret');
  });

  it('rejects rotate when the org has no webhook', async () => {
    const prisma = makePrisma();
    const service = new IntegrationsService(prisma, makeConfig() as never);
    await expect(service.rotateWebhookSecret('org-1', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects invalid protocol, public http, and private URLs', async () => {
    const prisma = makePrisma();
    const service = new IntegrationsService(prisma, makeConfig() as never);
    await expect(
      service.upsertWebhook('org-1', 'user-1', { url: 'ftp://evil.example/x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upsertWebhook('org-1', 'user-1', { url: 'http://hooks.example.com/x' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const ssrf = jest.requireMock('../website-analysis/ssrf') as {
      assertSafePublicUrl: jest.Mock;
      SsrfBlockedError: new (message: string) => Error;
    };
    ssrf.assertSafePublicUrl.mockRejectedValueOnce(new ssrf.SsrfBlockedError('private host'));
    await expect(
      service.upsertWebhook('org-1', 'user-1', { url: 'https://10.0.0.5/hooks' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists Entregas for the session org without payload', async () => {
    const prisma = makePrisma();
    prisma.outboxEvent.findMany.mockResolvedValue([
      {
        id: 'evt-1',
        type: 'lead.created',
        createdAt: new Date('2026-09-08T00:00:00.000Z'),
        status: 'PROCESSED',
        attempts: 1,
        lastError: null,
        skipReason: 'no_active_webhook',
        processedAt: new Date('2026-09-08T00:00:01.000Z'),
      },
    ]);
    const service = new IntegrationsService(prisma, makeConfig() as never);

    const rows = await service.listDeliveries('org-1');

    expect(prisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', retainUntil: { gte: expect.any(Date) } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: expect.objectContaining({
          id: true,
          type: true,
          skipReason: true,
        }),
      }),
    );
    const select = prisma.outboxEvent.findMany.mock.calls[0][0].select as Record<string, boolean>;
    expect(select.payload).toBeUndefined();
    expect(rows[0]).toEqual(
      expect.objectContaining({
        id: 'evt-1',
        type: 'lead.created',
        skipReason: 'no_active_webhook',
        status: 'PROCESSED',
      }),
    );
    expect(JSON.stringify(rows)).not.toContain('payload');
  });
});
