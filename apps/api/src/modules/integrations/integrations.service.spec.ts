import { BadRequestException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { IntegrationsService, WEBHOOK_PROVIDER } from './integrations.service';

const makePrisma = () => {
  const prisma = {
    integration: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  return prisma as unknown as PrismaService & {
    integration: { findMany: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock };
  };
};

describe('IntegrationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists integrations for the organization', async () => {
    const prisma = makePrisma();
    prisma.integration.findMany.mockResolvedValue([
      {
        id: 'int-1',
        organizationId: 'org-1',
        provider: WEBHOOK_PROVIDER,
        status: 'ENABLED',
        config: { url: 'https://hooks.example.com/x', label: 'CRM' },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ]);
    const service = new IntegrationsService(prisma);

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
      }),
    ]);
  });

  it('upserts webhook and writes minimal audit metadata without full URL', async () => {
    const prisma = makePrisma();
    prisma.integration.upsert.mockResolvedValue({
      id: 'int-1',
      organizationId: 'org-1',
      provider: WEBHOOK_PROVIDER,
      status: 'ENABLED',
      config: { url: 'https://hooks.example.com/secret?token=abc' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.auditLog.create.mockResolvedValue({});
    const service = new IntegrationsService(prisma);

    await service.upsertWebhook('org-1', 'user-1', {
      url: 'https://hooks.example.com/secret?token=abc',
      enabled: true,
    });

    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId_provider: { organizationId: 'org-1', provider: WEBHOOK_PROVIDER },
        },
      }),
    );
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
  });

  it('rejects invalid protocol', async () => {
    const prisma = makePrisma();
    const service = new IntegrationsService(prisma);
    await expect(
      service.upsertWebhook('org-1', 'user-1', { url: 'ftp://evil.example/x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
