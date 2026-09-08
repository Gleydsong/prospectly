import { Injectable, NotFoundException } from '@nestjs/common';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002',
  );
}

export type PersistEmailInput = {
  organizationId: string;
  leadId: string;
  connectionId: string;
  externalId: string;
  threadId: string;
  occurredAt: Date;
  direction: 'IN' | 'OUT';
  from: string[];
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  htmlLink: string;
  now?: Date;
};

export type PersistEventInput = {
  organizationId: string;
  leadId: string;
  connectionId: string;
  externalId: string;
  occurredAt: Date;
  from: string[];
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  htmlLink: string;
  now?: Date;
};

export type SyncedCommunicationView = {
  id: string;
  channel: 'EMAIL' | 'CALENDAR';
  externalId: string;
  threadId: string | null;
  occurredAt: string;
  direction: 'IN' | 'OUT' | 'EVENT';
  from: string[];
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  htmlLink: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForLead(organizationId: string, leadId: string, page = 1, pageSize = 50) {
    await this.assertReadableLead(organizationId, leadId);
    const safePage =
      Number.isFinite(Number(page)) && Number(page) > 0 ? Math.floor(Number(page)) : 1;
    const safePageSize = Math.min(
      100,
      Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Math.floor(Number(pageSize)) : 50,
    );
    const where = { organizationId, leadId };
    const [total, rows] = await Promise.all([
      this.prisma.syncedCommunication.count({ where }),
      this.prisma.syncedCommunication.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);
    return paginate(rows.map(serialize), total, safePage, safePageSize);
  }

  async persistEmail(input: PersistEmailInput): Promise<'created' | 'duplicate'> {
    return this.persistRow({
      ...input,
      channel: 'EMAIL',
      threadId: input.threadId,
    });
  }

  async persistEvent(input: PersistEventInput): Promise<'created' | 'duplicate'> {
    return this.persistRow({
      ...input,
      channel: 'CALENDAR',
      direction: 'EVENT',
      threadId: null,
    });
  }

  private async persistRow(input: {
    organizationId: string;
    leadId: string;
    connectionId: string;
    channel: 'EMAIL' | 'CALENDAR';
    externalId: string;
    threadId: string | null;
    occurredAt: Date;
    direction: 'IN' | 'OUT' | 'EVENT';
    from: string[];
    to: string[];
    cc: string[];
    subject: string;
    snippet: string;
    htmlLink: string;
    now?: Date;
  }): Promise<'created' | 'duplicate'> {
    try {
      await this.prisma.syncedCommunication.create({
        data: {
          organizationId: input.organizationId,
          leadId: input.leadId,
          channel: input.channel,
          externalId: input.externalId,
          threadId: input.threadId,
          occurredAt: input.occurredAt,
          direction: input.direction,
          fromAddresses: input.from,
          toAddresses: input.to,
          ccAddresses: input.cc,
          subject: input.subject,
          snippet: input.snippet,
          htmlLink: input.htmlLink,
          ingestedByConnectionId: input.connectionId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) return 'duplicate';
      throw error;
    }
    await this.advanceLastContactAt(
      input.organizationId,
      input.leadId,
      input.occurredAt,
      input.now ?? new Date(),
    );
    return 'created';
  }

  private async advanceLastContactAt(
    organizationId: string,
    leadId: string,
    occurredAt: Date,
    now: Date,
  ): Promise<void> {
    if (occurredAt.getTime() > now.getTime()) return;
    await this.prisma.lead.updateMany({
      where: {
        id: leadId,
        organizationId,
        deletedAt: null,
        OR: [{ lastContactAt: null }, { lastContactAt: { lt: occurredAt } }],
      },
      data: { lastContactAt: occurredAt },
    });
  }

  private async assertReadableLead(organizationId: string, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException('Lead not found');
  }
}

function serialize(row: {
  id: string;
  channel: 'EMAIL' | 'CALENDAR';
  externalId: string;
  threadId: string | null;
  occurredAt: Date;
  direction: 'IN' | 'OUT' | 'EVENT';
  fromAddresses: unknown;
  toAddresses: unknown;
  ccAddresses: unknown;
  subject: string;
  snippet: string;
  htmlLink: string;
}): SyncedCommunicationView {
  return {
    id: row.id,
    channel: row.channel,
    externalId: row.externalId,
    threadId: row.threadId,
    occurredAt: row.occurredAt.toISOString(),
    direction: row.direction,
    from: asStringArray(row.fromAddresses),
    to: asStringArray(row.toAddresses),
    cc: asStringArray(row.ccAddresses),
    subject: row.subject,
    snippet: row.snippet,
    htmlLink: row.htmlLink,
  };
}
