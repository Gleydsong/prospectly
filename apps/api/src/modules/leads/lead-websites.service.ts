import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LeadWebsiteKind } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { CreateLeadWebsiteDto, UpdateLeadWebsiteDto } from './dto/lead-website.dto';
import { normalizeLeadWebsiteUrl } from './normalize-lead-website-url';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

@Injectable()
export class LeadWebsitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, leadId: string) {
    await this.requireLead(organizationId, leadId);
    return this.prisma.leadWebsite.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(organizationId: string, leadId: string, dto: CreateLeadWebsiteDto) {
    await this.requireLead(organizationId, leadId);
    const urlNormalized = this.normalizeOrThrow(dto.url);
    try {
      return await this.prisma.leadWebsite.create({
        data: {
          leadId,
          url: dto.url.trim(),
          urlNormalized,
          label: dto.label?.trim() || null,
          kind: (dto.kind ?? 'site') as LeadWebsiteKind,
          notes: dto.notes?.trim() || null,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A website with this URL already exists on the lead');
      }
      throw error;
    }
  }

  async update(
    organizationId: string,
    leadId: string,
    websiteId: string,
    dto: UpdateLeadWebsiteDto,
  ) {
    await this.requireOwnedWebsite(organizationId, leadId, websiteId);
    const data: {
      url?: string;
      urlNormalized?: string;
      label?: string | null;
      kind?: LeadWebsiteKind;
      notes?: string | null;
    } = {};
    if (dto.url !== undefined) {
      data.url = dto.url.trim();
      data.urlNormalized = this.normalizeOrThrow(dto.url);
    }
    if (dto.label !== undefined) {
      data.label = dto.label?.trim() || null;
    }
    if (dto.kind !== undefined) {
      data.kind = dto.kind;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes?.trim() || null;
    }
    try {
      return await this.prisma.leadWebsite.update({
        where: { id: websiteId },
        data,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A website with this URL already exists on the lead');
      }
      throw error;
    }
  }

  async remove(organizationId: string, leadId: string, websiteId: string): Promise<void> {
    await this.requireOwnedWebsite(organizationId, leadId, websiteId);
    await this.prisma.leadWebsite.delete({ where: { id: websiteId } });
  }

  private async requireLead(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return lead;
  }

  private async requireOwnedWebsite(organizationId: string, leadId: string, websiteId: string) {
    await this.requireLead(organizationId, leadId);
    const row = await this.prisma.leadWebsite.findFirst({
      where: { id: websiteId, leadId },
      select: { id: true },
    });
    if (!row) {
      throw new NotFoundException('Website not found');
    }
    return row;
  }

  private normalizeOrThrow(raw: string): string {
    try {
      return normalizeLeadWebsiteUrl(raw);
    } catch {
      throw new BadRequestException('Invalid website URL');
    }
  }
}
