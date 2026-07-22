import { ConflictException, NotFoundException } from '@nestjs/common';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { LeadsService } from './leads.service';
import type { CreateLeadDto } from './dto/create-lead.dto';

const makePrisma = () => {
  const prisma = {
    lead: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tag: { findMany: jest.fn(), upsert: jest.fn() },
    leadTag: { createMany: jest.fn(), deleteMany: jest.fn() },
    leadActivity: { create: jest.fn() },
    organizationMember: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  return prisma as unknown as PrismaService & {
    lead: {
      count: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    organizationMember: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
};

const baseDto: CreateLeadDto = {
  companyName: 'Restaurante Teste',
  email: 'contato@teste.pt',
  website: 'https://teste.pt',
  phone: '+351210000000',
};

describe('LeadsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('create throws ConflictException when domain already exists', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'dup-1', companyName: 'Outro' });
    const service = new LeadsService(prisma);

    await expect(service.create('org1', baseDto, 'user1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('create stores normalized domain and lowercases email', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });
    prisma.lead.create.mockImplementation(({ data }) => Promise.resolve({ ...data, tags: [] }));
    const service = new LeadsService(prisma);

    await service.create('org1', { ...baseDto, email: 'CONTATO@Teste.pt' }, 'user1');

    expect(prisma.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org1',
          domain: 'teste.pt',
          email: 'contato@teste.pt',
        }),
      }),
    );
  });

  it('list always scopes by organization and excludes soft-deleted', async () => {
    const prisma = makePrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new LeadsService(prisma);

    await service.list('org1', { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' });

    expect(prisma.lead.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ organizationId: 'org1', deletedAt: null }),
    });
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org1', deletedAt: null }),
      }),
    );
  });

  it('getById throws NotFoundException for lead from another org', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue(null);
    const service = new LeadsService(prisma);

    await expect(service.getById('org-A', 'lead-from-org-B')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.lead.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-A' }),
      }),
    );
  });

  it('softDelete marks deletedAt instead of removing row', async () => {
    const prisma = makePrisma();
    prisma.lead.findFirst.mockResolvedValue({ id: 'l1', organizationId: 'org1' });
    prisma.lead.update.mockResolvedValue({});
    const service = new LeadsService(prisma);

    await service.softDelete('org1', 'l1');

    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );
  });
});
