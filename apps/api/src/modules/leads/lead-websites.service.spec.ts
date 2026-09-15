import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { LeadWebsitesService } from './lead-websites.service';

const makePrisma = () => {
  const prisma = {
    lead: { findFirst: jest.fn() },
    leadWebsite: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    website: { create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
  return prisma as unknown as PrismaService & {
    lead: { findFirst: jest.Mock };
    leadWebsite: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    website: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };
};

describe('LeadWebsitesService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a website on a lead that is not won', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', status: 'NEW' });
    prisma.leadWebsite.create.mockResolvedValue({
      id: 'lw-1',
      leadId: 'lead-1',
      url: 'https://loja.example/app',
      urlNormalized: 'https://loja.example/app',
      label: 'Loja WP',
      kind: 'site',
      notes: null,
    });
    const service = new LeadWebsitesService(prisma);

    const result = await service.create('org-1', 'lead-1', {
      url: 'https://Loja.Example/app/',
      label: 'Loja WP',
    });

    expect(result.id).toBe('lw-1');
    expect(prisma.leadWebsite.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: 'lead-1',
          urlNormalized: 'https://loja.example/app',
          kind: 'site',
        }),
      }),
    );
    expect(prisma.website.create).not.toHaveBeenCalled();
  });

  it('maps a duplicate normalized URL on the same lead to ConflictException', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', status: 'NEW' });
    prisma.leadWebsite.create.mockRejectedValue({ code: 'P2002' });
    const service = new LeadWebsitesService(prisma);

    await expect(
      service.create('org-1', 'lead-1', { url: 'https://loja.example' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when the lead is missing or in another org', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    const service = new LeadWebsitesService(prisma);

    await expect(
      service.create('org-1', 'lead-missing', { url: 'https://loja.example' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.leadWebsite.create).not.toHaveBeenCalled();
  });

  it('rejects a non-http URL', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', status: 'WON' });
    const service = new LeadWebsitesService(prisma);

    await expect(
      service.create('org-1', 'lead-1', { url: 'javascript:alert(1)' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.leadWebsite.create).not.toHaveBeenCalled();
  });
});
