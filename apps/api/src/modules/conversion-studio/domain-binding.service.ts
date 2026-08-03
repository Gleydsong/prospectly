import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementService } from './entitlement.service';

const HOSTNAME_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

@Injectable()
export class DomainBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementService,
  ) {}

  async list(organizationId: string) {
    return this.prisma.domainBinding.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(organizationId: string, hostnameRaw: string, pageId?: string) {
    await this.entitlements.assertFeature(organizationId, 'custom_domain');
    const hostname = hostnameRaw.trim().toLowerCase();
    if (!HOSTNAME_RE.test(hostname) || hostname.includes('://')) {
      throw new BadRequestException('Invalid hostname');
    }
    if (pageId) {
      const page = await this.prisma.conversionPage.findFirst({
        where: { id: pageId, organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!page) throw new BadRequestException('Page not found in organization');
    }

    const verificationToken = randomBytes(16).toString('hex');
    try {
      return await this.prisma.domainBinding.create({
        data: {
          organizationId,
          hostname,
          pageId,
          verificationToken,
        },
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Hostname already registered');
      }
      throw error;
    }
  }

  async verify(organizationId: string, id: string) {
    await this.entitlements.assertFeature(organizationId, 'custom_domain');
    const binding = await this.prisma.domainBinding.findFirst({
      where: { id, organizationId },
    });
    if (!binding) throw new NotFoundException('Domain binding not found');

    const expected = `prospectly-verify=${binding.verificationToken}`;
    let records: string[][] = [];
    try {
      records = await dns.resolveTxt(binding.hostname);
    } catch {
      await this.prisma.domainBinding.update({
        where: { id: binding.id },
        data: { lastCheckedAt: new Date() },
      });
      throw new BadRequestException({
        code: 'DNS_TXT_NOT_FOUND',
        message: 'TXT record not found yet',
        expectedTxt: expected,
      });
    }

    const flat = records.map((parts) => parts.join(''));
    const matched = flat.some((value) => value.trim() === expected);
    const updated = await this.prisma.domainBinding.update({
      where: { id: binding.id },
      data: {
        lastCheckedAt: new Date(),
        verifiedAt: matched ? new Date() : null,
      },
    });

    if (!matched) {
      throw new BadRequestException({
        code: 'DNS_TXT_MISMATCH',
        message: 'TXT record does not match verification token',
        expectedTxt: expected,
      });
    }

    return {
      ...updated,
      expectedTxt: expected,
    };
  }

  async remove(organizationId: string, id: string) {
    const binding = await this.prisma.domainBinding.findFirst({
      where: { id, organizationId },
    });
    if (!binding) throw new NotFoundException('Domain binding not found');
    await this.prisma.domainBinding.delete({ where: { id } });
  }
}
