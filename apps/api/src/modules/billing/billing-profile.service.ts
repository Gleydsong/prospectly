import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AsaasClient } from './infrastructure/asaas.client';

export type BillingProfileInput = {
  name: string;
  cpfCnpj: string;
  phone: string;
  email: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  postalCode: string;
};

@Injectable()
export class BillingProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly asaasClient: AsaasClient,
  ) {}

  getProfile(organizationId: string) {
    return this.prisma.billingProfile.findUnique({ where: { organizationId } });
  }

  async updateProfile(organizationId: string, input: BillingProfileInput) {
    const normalized = {
      name: input.name.trim(),
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ''),
      phone: input.phone.replace(/\D/g, ''),
      email: input.email.trim().toLowerCase(),
      address: input.address.trim(),
      addressNumber: input.addressNumber.trim(),
      complement: input.complement?.trim() ? input.complement.trim() : null,
      province: input.province.trim(),
      postalCode: input.postalCode.replace(/\D/g, ''),
    };
    const profile = await this.prisma.billingProfile.upsert({
      where: { organizationId },
      create: { organizationId, ...normalized },
      update: normalized,
    });

    if (this.config.get<boolean>('asaas.enabled') !== true) {
      return profile;
    }

    const asaasCustomerId = await this.asaasClient.ensureCustomer({
      organizationId,
      name: normalized.name,
      cpfCnpj: normalized.cpfCnpj,
      phone: normalized.phone,
      email: normalized.email,
      address: normalized.address,
      addressNumber: normalized.addressNumber,
      complement: normalized.complement,
      province: normalized.province,
      postalCode: normalized.postalCode,
      existingCustomerId: profile.asaasCustomerId,
    });
    if (asaasCustomerId === profile.asaasCustomerId) {
      return profile;
    }
    return this.prisma.billingProfile.update({
      where: { organizationId },
      data: { asaasCustomerId },
    });
  }
}
