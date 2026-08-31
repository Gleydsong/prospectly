import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { BillingProfileService } from './billing-profile.service';
import { AsaasClient } from './infrastructure/asaas.client';

const payerAddress = {
  address: 'Rua das Flores',
  addressNumber: '100',
  province: 'Centro',
  postalCode: '01310100',
};

describe('BillingProfileService', () => {
  const prisma = {
    billingProfile: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  const asaasClient = { ensureCustomer: jest.fn() };
  const config = { get: jest.fn() };
  let service: BillingProfileService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: AsaasClient, useValue: asaasClient },
      ],
    }).compile();
    service = module.get(BillingProfileService);
  });

  it('stores the organization billing profile without calling Asaas while disabled', async () => {
    config.get.mockReturnValue(false);
    prisma.billingProfile.upsert.mockResolvedValue({
      organizationId: 'org-1',
      name: 'Acme Ltda',
      cpfCnpj: '11222333000181',
      phone: '11999999999',
      email: 'financeiro@acme.test',
      asaasCustomerId: null,
    });

    await expect(
      service.updateProfile('org-1', {
        name: 'Acme Ltda',
        cpfCnpj: '11.222.333/0001-81',
        phone: '(11) 99999-9999',
        email: 'financeiro@acme.test',
        ...payerAddress,
      }),
    ).resolves.toMatchObject({
      organizationId: 'org-1',
      cpfCnpj: '11222333000181',
      phone: '11999999999',
      asaasCustomerId: null,
    });

    expect(prisma.billingProfile.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      create: {
        organizationId: 'org-1',
        name: 'Acme Ltda',
        cpfCnpj: '11222333000181',
        phone: '11999999999',
        email: 'financeiro@acme.test',
        complement: null,
        ...payerAddress,
      },
      update: {
        name: 'Acme Ltda',
        cpfCnpj: '11222333000181',
        phone: '11999999999',
        email: 'financeiro@acme.test',
        complement: null,
        ...payerAddress,
      },
    });
    expect(asaasClient.ensureCustomer).not.toHaveBeenCalled();
  });

  it('stores the Asaas customer id after a successful payer sync', async () => {
    config.get.mockReturnValue(true);
    prisma.billingProfile.upsert.mockResolvedValue({
      organizationId: 'org-1',
      name: 'Acme Ltda',
      cpfCnpj: '11222333000181',
      phone: '11999999999',
      email: 'financeiro@acme.test',
      asaasCustomerId: null,
    });
    prisma.billingProfile.update.mockResolvedValue({
      organizationId: 'org-1',
      asaasCustomerId: 'cus_1',
    });
    asaasClient.ensureCustomer.mockResolvedValue('cus_1');

    await expect(
      service.updateProfile('org-1', {
        name: 'Acme Ltda',
        cpfCnpj: '11.222.333/0001-81',
        phone: '(11) 99999-9999',
        email: 'financeiro@acme.test',
        ...payerAddress,
      }),
    ).resolves.toMatchObject({ asaasCustomerId: 'cus_1' });
    expect(asaasClient.ensureCustomer).toHaveBeenCalledWith({
      organizationId: 'org-1',
      name: 'Acme Ltda',
      cpfCnpj: '11222333000181',
      phone: '11999999999',
      email: 'financeiro@acme.test',
      complement: null,
      existingCustomerId: null,
      ...payerAddress,
    });
  });

  it('propagates Asaas payer validation errors instead of a generic 503', async () => {
    config.get.mockReturnValue(true);
    prisma.billingProfile.upsert.mockResolvedValue({
      organizationId: 'org-1',
      asaasCustomerId: null,
    });
    asaasClient.ensureCustomer.mockRejectedValue(
      new BadRequestException('O CPF informado é inválido'),
    );

    await expect(
      service.updateProfile('org-1', {
        name: 'Acme Ltda',
        cpfCnpj: '11111111111',
        phone: '11999999999',
        email: 'financeiro@acme.test',
        ...payerAddress,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'O CPF informado é inválido',
    });
  });

  it('returns the organization billing profile', async () => {
    prisma.billingProfile.findUnique.mockResolvedValue({
      organizationId: 'org-1',
      name: 'Acme Ltda',
      cpfCnpj: '11222333000181',
      phone: '11999999999',
      email: 'financeiro@acme.test',
      asaasCustomerId: 'cus_1',
    });

    await expect(service.getProfile('org-1')).resolves.toMatchObject({
      organizationId: 'org-1',
      asaasCustomerId: 'cus_1',
    });
    expect(prisma.billingProfile.findUnique).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
  });
});
