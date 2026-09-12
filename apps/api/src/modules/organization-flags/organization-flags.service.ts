import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import {
  isOrganizationFlagKey,
  ORGANIZATION_FLAG_KEYS,
  type OrganizationFlagKey,
} from './organization-flags.constants';

export type OrganizationFlagView = {
  key: OrganizationFlagKey;
  enabled: boolean;
};

@Injectable()
export class OrganizationFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<OrganizationFlagView[]> {
    const rows = await this.prisma.organizationFlag.findMany({
      where: { organizationId },
      select: { key: true, enabled: true },
    });
    const enabledByKey = new Map(
      rows.filter((row) => isOrganizationFlagKey(row.key)).map((row) => [row.key, row.enabled]),
    );
    return ORGANIZATION_FLAG_KEYS.map((key) => ({
      key,
      enabled: enabledByKey.get(key) ?? false,
    }));
  }

  async isEnabled(organizationId: string, key: OrganizationFlagKey): Promise<boolean> {
    this.assertKey(key);
    const row = await this.prisma.organizationFlag.findFirst({
      where: { organizationId, key },
      select: { enabled: true },
    });
    return row?.enabled ?? false;
  }

  async set(organizationId: string, key: string, enabled: boolean): Promise<OrganizationFlagView> {
    this.assertKey(key);
    await this.prisma.organizationFlag.upsert({
      where: { organizationId_key: { organizationId, key } },
      create: { organizationId, key, enabled },
      update: { enabled },
      select: { key: true, enabled: true },
    });
    return { key, enabled };
  }

  private assertKey(key: string): asserts key is OrganizationFlagKey {
    if (!isOrganizationFlagKey(key)) {
      throw new BadRequestException({
        code: 'UNKNOWN_ORGANIZATION_FLAG',
        message: 'Flag de organização desconhecida.',
      });
    }
  }
}
