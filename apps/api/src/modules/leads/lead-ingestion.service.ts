import { Injectable, Optional } from '@nestjs/common';
import { ConfidenceLevel, LeadSource, LeadStatus, Prisma, WebsitePresence } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { WebsiteAnalysisService } from '../website-analysis/website-analysis.service';

const INGESTED_LEAD_INCLUDE = {
  owner: { select: { id: true, name: true, email: true } },
  stage: { select: { id: true, name: true, color: true } },
  tags: { include: { tag: true } },
  contacts: true,
} satisfies Prisma.LeadInclude;

type IngestedLead = Prisma.LeadGetPayload<{ include: typeof INGESTED_LEAD_INCLUDE }>;
type DuplicateLead = Pick<IngestedLead, 'id' | 'companyName'>;

export interface LeadIngestionCandidate {
  companyName: string;
  ownerId?: string;
  tradeName?: string;
  category?: string;
  segment?: string;
  description?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  domain?: string;
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  openingHours?: Prisma.InputJsonValue;
  source?: LeadSource;
  externalId?: string;
  status?: LeadStatus;
  websitePresence?: WebsitePresence;
  websiteCheckedAt?: Date;
  websiteCheckSource?: string;
  websiteStatusReason?: string;
  confidenceLevel?: ConfidenceLevel;
  lastVerifiedAt?: Date;
  notes?: string;
  tags?: string[];
}

export type LeadIngestionResult =
  | { status: 'IMPORTED'; lead: IngestedLead }
  | { status: 'DUPLICATE' | 'POSSIBLE_DUPLICATE'; lead: DuplicateLead | null };

export function normalizeBrazilianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : '';
}

/** Keep leading + and digits only (light E.164); do not force a country code. */
export function normalizeInternationalPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : `+${digits}`;
}

export function normalizePhoneForCountry(phone: string, country?: string | null): string {
  const code = (country ?? 'BR').trim().toUpperCase();
  if (code === 'BR' || code === '') {
    return normalizeBrazilianPhone(phone);
  }
  return normalizeInternationalPhone(phone);
}

function normalizeComparable(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildProbableDuplicateKey(
  companyName: string,
  city?: string | null,
  state?: string | null,
): string | undefined {
  if (!city?.trim() || !state?.trim()) return undefined;
  return `${normalizeComparable(companyName)}|${normalizeComparable(city)}|${state.trim().toUpperCase()}`;
}

function normalizeDomain(website?: string, domain?: string): string | undefined {
  if (domain) {
    return (
      domain
        .trim()
        .replace(/^www\./i, '')
        .toLowerCase() || undefined
    );
  }
  if (!website) {
    return undefined;
  }
  try {
    const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    return url.hostname.replace(/^www\./i, '').toLowerCase() || undefined;
  } catch {
    return undefined;
  }
}

function normalizeTagNames(names: string[] | undefined): string[] {
  return [...new Set((names ?? []).map((name) => name.trim()).filter(Boolean))];
}

@Injectable()
export class LeadIngestionService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly websiteAnalysis?: WebsiteAnalysisService,
  ) {}

  async ingest(
    organizationId: string,
    actorId: string,
    candidate: LeadIngestionCandidate,
  ): Promise<LeadIngestionResult> {
    const normalized = this.normalizeCandidate(candidate);

    try {
      const result = await this.prisma.$transaction(async (transaction) => {
        const strongDuplicate = await this.findStrongDuplicate(
          transaction,
          organizationId,
          normalized,
        );
        if (strongDuplicate) {
          return { status: 'DUPLICATE' as const, lead: strongDuplicate };
        }

        const possibleDuplicate = await this.findPossibleDuplicate(
          transaction,
          organizationId,
          normalized,
        );
        if (possibleDuplicate) {
          return { status: 'POSSIBLE_DUPLICATE' as const, lead: possibleDuplicate };
        }

        const tags = await this.upsertTags(transaction, organizationId, normalized.tags);

        const lead = await transaction.lead.create({
          data: {
            organizationId,
            ownerId: normalized.ownerId ?? actorId,
            companyName: normalized.companyName,
            tradeName: normalized.tradeName,
            category: normalized.category,
            segment: normalized.segment,
            description: normalized.description,
            phone: normalized.phone,
            email: normalized.email,
            whatsapp: normalized.whatsapp,
            website: normalized.website,
            domain: normalized.domain,
            instagram: normalized.instagram,
            facebook: normalized.facebook,
            linkedin: normalized.linkedin,
            address: normalized.address,
            city: normalized.city,
            state: normalized.state,
            country: normalized.country,
            postalCode: normalized.postalCode,
            latitude: normalized.latitude,
            longitude: normalized.longitude,
            rating: normalized.rating,
            reviewCount: normalized.reviewCount,
            openingHours: normalized.openingHours,
            source: normalized.source,
            externalId: normalized.externalId,
            status: normalized.status,
            websitePresence: normalized.websitePresence,
            websiteCheckedAt: normalized.websiteCheckedAt,
            websiteCheckSource: normalized.websiteCheckSource,
            websiteStatusReason: normalized.websiteStatusReason,
            confidenceLevel: normalized.confidenceLevel,
            lastVerifiedAt: normalized.lastVerifiedAt,
            notes: normalized.notes,
            probableDuplicateKey: normalized.probableDuplicateKey,
            dataCollectedAt: new Date(),
            tags: tags.length ? { create: tags.map((tag) => ({ tagId: tag.id })) } : undefined,
          },
          include: INGESTED_LEAD_INCLUDE,
        });
        return { status: 'IMPORTED' as const, lead };
      });

      if (result.status === 'IMPORTED' && this.websiteAnalysis) {
        // Detached on purpose; onLeadUpsert must soft-fail — never let a rejection crash Node.
        void this.websiteAnalysis
          .onLeadUpsert(organizationId, result.lead.id, result.lead.website)
          .catch(() => undefined);
      }

      return result;
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }
      const duplicate = await this.findStrongDuplicate(this.prisma, organizationId, normalized);
      if (duplicate) return { status: 'DUPLICATE', lead: duplicate };
      const possibleDuplicate = await this.findPossibleDuplicate(
        this.prisma,
        organizationId,
        normalized,
      );
      return possibleDuplicate
        ? { status: 'POSSIBLE_DUPLICATE', lead: possibleDuplicate }
        : { status: 'DUPLICATE', lead: null };
    }
  }

  private normalizeCandidate(candidate: LeadIngestionCandidate) {
    const country = candidate.country?.trim().toUpperCase() || 'BR';
    return {
      ...candidate,
      companyName: candidate.companyName.trim(),
      phone: candidate.phone
        ? normalizePhoneForCountry(candidate.phone, country)
        : undefined,
      email: candidate.email?.trim().toLowerCase(),
      domain: normalizeDomain(candidate.website, candidate.domain),
      city: candidate.city?.trim(),
      state:
        country === 'BR'
          ? candidate.state?.trim().toUpperCase()
          : candidate.state?.trim(),
      country,
      probableDuplicateKey: buildProbableDuplicateKey(
        candidate.companyName,
        candidate.city,
        candidate.state,
      ),
      source: candidate.source ?? LeadSource.MANUAL,
      status: candidate.status ?? LeadStatus.TO_REVIEW,
      websitePresence: candidate.websitePresence ?? WebsitePresence.NEEDS_REVIEW,
      tags: normalizeTagNames(candidate.tags),
    };
  }

  private async findStrongDuplicate(
    transaction: Pick<Prisma.TransactionClient, 'lead'>,
    organizationId: string,
    candidate: ReturnType<LeadIngestionService['normalizeCandidate']>,
  ): Promise<DuplicateLead | null> {
    const select = { id: true, companyName: true } as const;
    if (candidate.externalId) {
      const duplicate = await transaction.lead.findFirst({
        where: {
          organizationId,
          source: candidate.source,
          externalId: candidate.externalId,
        },
        select,
      });
      if (duplicate) return duplicate;
    }

    for (const field of ['domain', 'phone', 'email'] as const) {
      const value = candidate[field];
      if (!value) continue;
      const duplicate = await transaction.lead.findFirst({
        where: { organizationId, [field]: value },
        select,
      });
      if (duplicate) return duplicate;
    }

    return null;
  }

  private async findPossibleDuplicate(
    transaction: Pick<Prisma.TransactionClient, 'lead'>,
    organizationId: string,
    candidate: ReturnType<LeadIngestionService['normalizeCandidate']>,
  ): Promise<DuplicateLead | null> {
    if (!candidate.probableDuplicateKey) {
      return null;
    }

    return transaction.lead.findFirst({
      where: {
        organizationId,
        probableDuplicateKey: candidate.probableDuplicateKey,
      },
      select: { id: true, companyName: true },
    });
  }

  private async upsertTags(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    names: string[],
  ) {
    return Promise.all(
      names.map((name) =>
        transaction.tag.upsert({
          where: { organizationId_name: { organizationId, name } },
          create: { organizationId, name },
          update: {},
        }),
      ),
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
    );
  }
}
