import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const LEAD_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  stage: { select: { id: true, name: true, color: true } },
  tags: { include: { tag: true } },
  contacts: true,
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: QueryLeadsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.segment ? { segment: { equals: query.segment, mode: 'insensitive' } } : {}),
      ...(query.city ? { city: { equals: query.city, mode: 'insensitive' } } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.hasWebsite === true ? { website: { not: null } } : {}),
      ...(query.hasWebsite === false ? { OR: [{ website: null }, { website: '' }] } : {}),
      ...(query.minScore !== undefined || query.maxScore !== undefined
        ? {
            score: {
              ...(query.minScore !== undefined ? { gte: query.minScore } : {}),
              ...(query.maxScore !== undefined ? { lte: query.maxScore } : {}),
            },
          }
        : {}),
      ...(query.tagId ? { tags: { some: { tagId: query.tagId } } } : {}),
      ...(query.q
        ? {
            OR: [
              { companyName: { contains: query.q, mode: 'insensitive' } },
              { tradeName: { contains: query.q, mode: 'insensitive' } },
              { email: { contains: query.q, mode: 'insensitive' } },
              { domain: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, leads] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return paginate(leads.map((lead) => this.serialize(lead)), total, query.page, query.pageSize);
  }

  async getById(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        ...LEAD_INCLUDE,
        websiteRecord: { include: { analyses: { orderBy: { createdAt: 'desc' }, take: 1, include: { issues: true } } } },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return this.serialize(lead, true);
  }

  async create(organizationId: string, dto: CreateLeadDto, actorId: string) {
    const domain = this.extractDomain(dto.website);
    await this.assertNotDuplicate(organizationId, {
      domain,
      email: dto.email,
      phone: dto.phone,
    });

    if (dto.ownerId) {
      await this.assertMember(organizationId, dto.ownerId);
    }

    const tagRecords = dto.tags?.length
      ? await this.upsertTags(organizationId, dto.tags)
      : [];

    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        ownerId: dto.ownerId ?? actorId,
        companyName: dto.companyName.trim(),
        tradeName: dto.tradeName,
        category: dto.category,
        segment: dto.segment,
        description: dto.description,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        whatsapp: dto.whatsapp,
        website: dto.website,
        domain,
        instagram: dto.instagram,
        facebook: dto.facebook,
        linkedin: dto.linkedin,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        postalCode: dto.postalCode,
        latitude: dto.latitude,
        longitude: dto.longitude,
        rating: dto.rating,
        reviewCount: dto.reviewCount,
        source: dto.source ?? 'MANUAL',
        status: dto.status ?? 'NEW',
        notes: dto.notes,
        dataCollectedAt: new Date(),
        tags: tagRecords.length
          ? { create: tagRecords.map((tag) => ({ tagId: tag.id })) }
          : undefined,
      },
      include: LEAD_INCLUDE,
    });

    return this.serialize(lead);
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto) {
    await this.ensureLead(organizationId, id);

    const domain = dto.website !== undefined ? this.extractDomain(dto.website) : undefined;
    if (dto.email !== undefined || dto.phone !== undefined || domain !== undefined) {
      await this.assertNotDuplicate(
        organizationId,
        { domain, email: dto.email, phone: dto.phone },
        id,
      );
    }

    const { tags, ...rest } = dto;
    void tags;

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...rest,
        email: dto.email === undefined ? undefined : dto.email?.toLowerCase(),
        ...(domain !== undefined ? { domain } : {}),
      },
      include: LEAD_INCLUDE,
    });
    return this.serialize(lead);
  }

  async softDelete(organizationId: string, id: string) {
    await this.ensureLead(organizationId, id);
    await this.prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId } });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    const restored = await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: null },
      include: LEAD_INCLUDE,
    });
    return this.serialize(restored);
  }

  async assignOwner(organizationId: string, id: string, ownerId: string, actorId: string) {
    const lead = await this.ensureLead(organizationId, id);
    await this.assertMember(organizationId, ownerId);

    const updated = await this.prisma.lead.update({
      where: { id },
      data: { ownerId },
      include: LEAD_INCLUDE,
    });

    await this.prisma.leadActivity.create({
      data: {
        organizationId,
        leadId: id,
        userId: actorId,
        type: 'OWNER_CHANGED',
        description: `Responsável alterado`,
        metadata: { from: lead.ownerId, to: ownerId },
      },
    });

    return this.serialize(updated);
  }

  async addTags(organizationId: string, id: string, tagNames: string[]) {
    await this.ensureLead(organizationId, id);
    if (!tagNames.length) {
      throw new BadRequestException('At least one tag is required');
    }
    const tags = await this.upsertTags(organizationId, tagNames);
    await this.prisma.leadTag.createMany({
      data: tags.map((tag) => ({ leadId: id, tagId: tag.id })),
      skipDuplicates: true,
    });
    return this.getById(organizationId, id);
  }

  async removeTag(organizationId: string, id: string, tagId: string) {
    await this.ensureLead(organizationId, id);
    await this.prisma.leadTag.deleteMany({ where: { leadId: id, tagId } });
    return this.getById(organizationId, id);
  }

  async listTags(organizationId: string) {
    return this.prisma.tag.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { leads: true } } },
    });
  }

  private async ensureLead(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private async assertMember(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) {
      throw new BadRequestException('Owner must be a member of the organization');
    }
  }

  private async assertNotDuplicate(
    organizationId: string,
    candidate: { domain?: string | null; email?: string | null; phone?: string | null },
    excludeLeadId?: string,
  ) {
    const conditions: Prisma.LeadWhereInput[] = [];
    if (candidate.domain) {
      conditions.push({ domain: candidate.domain });
    }
    if (candidate.email) {
      conditions.push({ email: candidate.email.toLowerCase() });
    }
    if (candidate.phone) {
      const normalized = this.normalizePhone(candidate.phone);
      conditions.push({ phone: candidate.phone });
      if (normalized !== candidate.phone) {
        conditions.push({ phone: normalized });
      }
    }
    if (!conditions.length) {
      return;
    }

    const duplicate = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: conditions,
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
      },
      select: { id: true, companyName: true },
    });

    if (duplicate) {
      throw new ConflictException(
        `Possible duplicate of existing lead "${duplicate.companyName}" (${duplicate.id})`,
      );
    }
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private extractDomain(website?: string | null): string | null {
    if (!website) {
      return null;
    }
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      return url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  }

  private async upsertTags(organizationId: string, names: string[]) {
    const normalized = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    return Promise.all(
      normalized.map((name) =>
        this.prisma.tag.upsert({
          where: { organizationId_name: { organizationId, name } },
          create: { organizationId, name },
          update: {},
        }),
      ),
    );
  }

  private serialize(lead: Record<string, unknown>, detailed = false) {
    const { tags, ...rest } = lead as { tags?: Array<{ tag: unknown }> } & Record<string, unknown>;
    const serialized = {
      ...rest,
      tags: tags?.map((entry) => entry.tag) ?? [],
    };
    if (!detailed) {
      delete (serialized as Record<string, unknown>).scores;
      delete (serialized as Record<string, unknown>).websiteRecord;
    }
    return serialized;
  }
}
