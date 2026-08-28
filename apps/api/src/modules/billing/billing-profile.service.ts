import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AsaasClient } from './infrastructure/asaas.client';

export type BillingProfileInput = {
  name: string;
  cpfCnpj: string;
  phone: string;
  email: string;
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
      ...normalized,
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
