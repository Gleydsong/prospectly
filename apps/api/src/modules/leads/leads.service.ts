import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { LeadSource, Prisma } from '@prisma/client';

import { paginate, type PaginatedResult } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EntitlementService } from '../conversion-studio/entitlement.service';
import { WebsiteAnalysisService } from '../website-analysis/website-analysis.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import {
  buildProbableDuplicateKey,
  LeadIngestionService,
  normalizeBrazilianPhone,
} from './lead-ingestion.service';
import {
  DEFAULT_EXPORT_COLUMNS,
  ExportLeadsDto,
  type ExportableLeadColumn,
} from './dto/export-leads.dto';
import { QueryLeadsDto } from './dto/query-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const EXPORT_MAX_ROWS = 10_000;

const LEAD_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  stage: { select: { id: true, name: true, color: true } },
  tags: { include: { tag: true } },
  contacts: true,
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadIngestion: LeadIngestionService,
    private readonly entitlements: EntitlementService,
    @Optional() private readonly websiteAnalysis?: WebsiteAnalysisService,
  ) {}

  async list(organizationId: string, query: QueryLeadsDto): Promise<PaginatedResult<unknown>> {
    const where = this.buildListWhere(organizationId, query);

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

    return paginate(
      leads.map((lead) => this.serialize(lead)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async getById(organizationId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        ...LEAD_INCLUDE,
        websiteRecord: {
          include: {
            analyses: { orderBy: { createdAt: 'desc' }, take: 1, include: { issues: true } },
          },
        },
        scores: { orderBy: { calculatedAt: 'desc' }, take: 1 },
      },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
    return this.serialize(lead, true);
  }

  async create(organizationId: string, dto: CreateLeadDto, actorId: string) {
    if (dto.ownerId) {
      await this.assertMember(organizationId, dto.ownerId);
    }

    const result = await this.leadIngestion.ingest(organizationId, actorId, {
      ...dto,
      source: LeadSource.MANUAL,
      externalId: undefined,
      websitePresence: undefined,
      websiteCheckSource: undefined,
      status: dto.status ?? 'NEW',
    });
    if (result.status !== 'IMPORTED') {
      const duplicate = result.lead;
      throw new ConflictException(
        duplicate
          ? `Possible duplicate of existing lead "${duplicate.companyName}" (${duplicate.id})`
          : 'Possible duplicate of an existing lead',
      );
    }

    return this.serialize(result.lead);
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto) {
    const existing = await this.ensureLead(organizationId, id);

    const domain = dto.website !== undefined ? this.extractDomain(dto.website) : undefined;
    const phone = dto.phone === undefined ? undefined : normalizeBrazilianPhone(dto.phone);
    const probableDuplicateKey = buildProbableDuplicateKey(
      dto.companyName ?? existing.companyName,
      dto.city ?? existing.city,
      dto.state ?? existing.state,
    );
    if (dto.email !== undefined || dto.phone !== undefined || domain !== undefined) {
      await this.assertNotDuplicate(organizationId, { domain, email: dto.email, phone }, id);
    }

    const { tags, ...rest } = dto;
    void tags;

    try {
      const lead = await this.prisma.lead.update({
        where: { id },
        data: {
          ...rest,
          email: dto.email === undefined ? undefined : dto.email?.toLowerCase(),
          phone,
          probableDuplicateKey,
          ...(domain !== undefined ? { domain } : {}),
        },
        include: LEAD_INCLUDE,
      });
      if (this.websiteAnalysis && (dto.website !== undefined || dto.phone !== undefined || dto.email !== undefined || dto.rating !== undefined)) {
        void this.websiteAnalysis.onLeadUpsert(organizationId, id, lead.website);
      }
      return this.serialize(lead);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException('Possible duplicate of an existing lead');
      }
      throw error;
    }
  }

  async requestWebsiteAnalysis(organizationId: string, id: string, correlationId?: string) {
    await this.ensureLead(organizationId, id);
    if (!this.websiteAnalysis) {
      throw new BadRequestException('Website analysis is not available');
    }
    return this.websiteAnalysis.enqueueForLead(organizationId, id, true, correlationId);
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

  async exportCsv(organizationId: string, userId: string, dto: ExportLeadsDto) {
    await this.entitlements.assertFeature(organizationId, 'csv_export');
    const columns = (dto.columns?.length ? dto.columns : DEFAULT_EXPORT_COLUMNS) as ExportableLeadColumn[];
    const where = this.buildListWhere(organizationId, dto);

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_MAX_ROWS,
      select: {
        id: true,
        companyName: true,
        tradeName: true,
        category: true,
        segment: true,
        email: true,
        phone: true,
        whatsapp: true,
        website: true,
        domain: true,
        city: true,
        state: true,
        country: true,
        status: true,
        source: true,
        score: true,
        rating: true,
        reviewCount: true,
        ownerId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        lastContactAt: true,
        nextContactAt: true,
      },
    });

    const csv = this.toCsv(columns, leads);
    const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: 'leads.export',
        entity: 'Lead',
        metadata: {
          rowCount: leads.length,
          columns,
          truncated: leads.length >= EXPORT_MAX_ROWS,
          filters: {
            status: dto.status ?? null,
            source: dto.source ?? null,
            ownerId: dto.ownerId ?? null,
            city: dto.city ?? null,
            segment: dto.segment ?? null,
            hasWebsite: dto.hasWebsite ?? null,
            hasQuery: Boolean(dto.q),
          },
        },
      },
    });

    return {
      filename,
      rowCount: leads.length,
      columns,
      csv,
    };
  }

  private buildListWhere(
    organizationId: string,
    query: Pick<
      QueryLeadsDto,
      | 'status'
      | 'source'
      | 'category'
      | 'segment'
      | 'city'
      | 'ownerId'
      | 'hasWebsite'
      | 'minScore'
      | 'maxScore'
      | 'tagId'
      | 'q'
    >,
  ): Prisma.LeadWhereInput {
    return {
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
  }

  private toCsv(
    columns: ExportableLeadColumn[],
    rows: Array<Record<string, unknown>>,
  ): string {
    const header = columns.map(escapeCsv).join(',');
    const lines = rows.map((row) =>
      columns
        .map((column) => {
          const value = row[column];
          if (value == null) return '';
          if (value instanceof Date) return escapeCsv(value.toISOString());
          return escapeCsv(String(value));
        })
        .join(','),
    );
    return [header, ...lines].join('\n');
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
      conditions.push({ phone: candidate.phone });
    }
    if (!conditions.length) {
      return;
    }

    const duplicate = await this.prisma.lead.findFirst({
      where: {
        organizationId,
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

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
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
    const serialized: Record<string, unknown> = {
      ...rest,
      tags: tags?.map((entry) => entry.tag) ?? [],
    };
    if (!detailed) {
      delete serialized.scores;
      delete serialized.websiteRecord;
    } else {
      serialized.missingFields = collectMissingLeadFields(serialized);
    }
    return serialized;
  }
}

const PROVENANCE_MISSING_FIELDS = [
  'phone',
  'email',
  'website',
  'whatsapp',
  'address',
  'city',
  'category',
] as const;

export function collectMissingLeadFields(lead: Record<string, unknown>): string[] {
  return PROVENANCE_MISSING_FIELDS.filter((field) => {
    const value = lead[field];
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
  });
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
