import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

export type SuppressionKind = 'EMAIL' | 'PHONE' | 'DOMAIN';

export function hashSuppressionValue(kind: SuppressionKind, raw: string): string {
  const canonical = canonicalizeSuppressionValue(kind, raw);
  return createHash('sha256').update(`${kind}:${canonical}`).digest('hex');
}

export function canonicalizeSuppressionValue(kind: SuppressionKind, raw: string): string {
  const trimmed = raw.trim();
  if (kind === 'EMAIL') return trimmed.toLowerCase();
  if (kind === 'DOMAIN') return trimmed.replace(/^www\./i, '').toLowerCase();
  return trimmed.replace(/\D/g, '');
}

@Injectable()
export class SuppressionService {
  constructor(private readonly prisma: PrismaService) {}

  async isSuppressed(
    organizationId: string,
    identifiers: { email?: string | null; phone?: string | null; domain?: string | null },
  ): Promise<boolean> {
    const hashes = this.collectHashes(identifiers);
    if (hashes.length === 0) return false;
    const match = await this.prisma.suppressionEntry.findFirst({
      where: {
        organizationId,
        OR: hashes.map((entry) => ({ kind: entry.kind, valueHash: entry.valueHash })),
      },
      select: { id: true },
    });
    return Boolean(match);
  }

  async suppressIdentifiers(
    organizationId: string,
    identifiers: { email?: string | null; phone?: string | null; domain?: string | null },
    source: string,
  ): Promise<void> {
    const hashes = this.collectHashes(identifiers);
    if (hashes.length === 0) return;
    await this.prisma.suppressionEntry.createMany({
      data: hashes.map((entry) => ({
        organizationId,
        kind: entry.kind,
        valueHash: entry.valueHash,
        source,
      })),
      skipDuplicates: true,
    });
  }

  async suppressFromLead(organizationId: string, leadId: string, source: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId },
      select: { email: true, phone: true, whatsapp: true, domain: true },
    });
    if (!lead) return;
    await this.suppressIdentifiers(
      organizationId,
      { email: lead.email, phone: lead.phone ?? lead.whatsapp, domain: lead.domain },
      source,
    );
  }

  private collectHashes(identifiers: {
    email?: string | null;
    phone?: string | null;
    domain?: string | null;
  }): Array<{ kind: SuppressionKind; valueHash: string }> {
    const out: Array<{ kind: SuppressionKind; valueHash: string }> = [];
    if (identifiers.email?.trim()) {
      out.push({ kind: 'EMAIL', valueHash: hashSuppressionValue('EMAIL', identifiers.email) });
    }
    if (identifiers.phone?.trim()) {
      out.push({ kind: 'PHONE', valueHash: hashSuppressionValue('PHONE', identifiers.phone) });
    }
    if (identifiers.domain?.trim()) {
      out.push({ kind: 'DOMAIN', valueHash: hashSuppressionValue('DOMAIN', identifiers.domain) });
    }
    return out;
  }
}
