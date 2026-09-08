import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import { isDuplicateJobError } from '../../common/workers/durable-job';
import { decryptRefreshToken } from '../google-connections/token-crypto';
import { CommunicationsService } from './communications.service';
import {
  GMAIL_BACKFILL_MS,
  GMAIL_INCREMENTAL_OVERLAP_MS,
  GMAIL_SYNC_JOB_OPTIONS,
  GMAIL_SYNC_QUEUE,
  SYNC_GMAIL_CONNECTION_JOB,
  type SyncGmailConnectionJobData,
} from './communications.constants';
import { GMAIL_PORT, type GmailMessageMetadata, type GmailPort } from './gmail.port';
import { directionFromSender, matchLeadIdsForAddresses, normalizeEmail } from './match-lead-email';

@Injectable()
export class GmailIngestService {
  private readonly logger = new Logger(GmailIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly communications: CommunicationsService,
    @Inject(GMAIL_PORT) private readonly gmail: GmailPort,
    @InjectQueue(GMAIL_SYNC_QUEUE)
    private readonly queue: Queue<SyncGmailConnectionJobData>,
  ) {}

  async enqueueConnection(
    organizationId: string,
    connectionId: string,
    correlationId?: string,
  ): Promise<void> {
    try {
      await this.queue.add(
        SYNC_GMAIL_CONNECTION_JOB,
        { organizationId, connectionId, correlationId },
        { ...GMAIL_SYNC_JOB_OPTIONS, jobId: `gmail-sync-${connectionId}` },
      );
    } catch (error) {
      if (!isDuplicateJobError(error)) throw error;
    }
  }

  async sweepActiveConnections(): Promise<void> {
    const rows = await runWithBypass(() =>
      this.prisma.googleConnection.findMany({
        where: { revokedAt: null, refreshTokenEncrypted: { not: null } },
        select: { id: true, organizationId: true },
      }),
    );
    for (const row of rows) {
      await this.enqueueConnection(row.organizationId, row.id);
    }
  }

  async syncConnection(
    organizationId: string,
    connectionId: string,
    now = new Date(),
  ): Promise<void> {
    const connection = await this.prisma.googleConnection.findFirst({
      where: {
        id: connectionId,
        organizationId,
        revokedAt: null,
        refreshTokenEncrypted: { not: null },
      },
    });
    if (!connection?.refreshTokenEncrypted) return;

    const keyHex = this.config.get<string>('google.tokenEncryptionKey')?.trim() ?? '';
    if (!keyHex) {
      await this.markError(connection.id, 'missing_token_encryption_key');
      return;
    }

    try {
      const refreshToken = decryptRefreshToken(connection.refreshTokenEncrypted, keyHex);
      const accessToken = await this.gmail.refreshAccessToken(refreshToken);
      const after = connection.lastSyncAt
        ? new Date(connection.lastSyncAt.getTime() - GMAIL_INCREMENTAL_OVERLAP_MS)
        : new Date(now.getTime() - GMAIL_BACKFILL_MS);
      const messages = await this.gmail.listMessages({ accessToken, after });
      const maps = await this.loadMatchMaps(
        organizationId,
        messages.flatMap((message) => [...message.from, ...message.to, ...message.cc]),
      );
      for (const message of messages) {
        await this.persistMatched(
          organizationId,
          connection.id,
          connection.googleEmail,
          message,
          maps,
          now,
        );
      }
      await this.prisma.googleConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now, lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'gmail_sync_failed';
      await this.markError(connection.id, message.slice(0, 180));
      throw error;
    }
  }

  private async persistMatched(
    organizationId: string,
    connectionId: string,
    connectionEmail: string,
    message: GmailMessageMetadata,
    maps: {
      leadIdByEmail: Map<string, string>;
      contactLeadIdsByEmail: Map<string, string[]>;
    },
    now: Date,
  ): Promise<void> {
    const leadIds = matchLeadIdsForAddresses({
      addresses: [...message.from, ...message.to, ...message.cc],
      leadIdByEmail: maps.leadIdByEmail,
      contactLeadIdsByEmail: maps.contactLeadIdsByEmail,
    });
    const direction = directionFromSender(message.from, connectionEmail);
    for (const leadId of leadIds) {
      await this.communications.persistEmail({
        organizationId,
        leadId,
        connectionId,
        externalId: message.externalId,
        threadId: message.threadId,
        occurredAt: message.occurredAt,
        direction,
        from: message.from,
        to: message.to,
        cc: message.cc,
        subject: message.subject,
        snippet: message.snippet,
        htmlLink: message.htmlLink,
        now,
      });
    }
  }

  private async loadMatchMaps(organizationId: string, rawEmails: string[]) {
    const emails = [...new Set(rawEmails.map(normalizeEmail).filter(Boolean))];
    const leadIdByEmail = new Map<string, string>();
    const contactLeadIdsByEmail = new Map<string, string[]>();
    if (emails.length === 0) {
      return { leadIdByEmail, contactLeadIdsByEmail };
    }

    const leads = await this.prisma.lead.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })),
      },
      select: { id: true, email: true },
    });
    for (const lead of leads) {
      if (!lead.email) continue;
      leadIdByEmail.set(normalizeEmail(lead.email), lead.id);
    }

    const contacts = await this.prisma.leadContact.findMany({
      where: {
        OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })),
        lead: { organizationId, deletedAt: null },
      },
      select: { email: true, leadId: true },
    });
    for (const contact of contacts) {
      if (!contact.email) continue;
      const key = normalizeEmail(contact.email);
      const current = contactLeadIdsByEmail.get(key) ?? [];
      current.push(contact.leadId);
      contactLeadIdsByEmail.set(key, current);
    }
    return { leadIdByEmail, contactLeadIdsByEmail };
  }

  private async markError(connectionId: string, lastError: string): Promise<void> {
    try {
      await this.prisma.googleConnection.update({
        where: { id: connectionId },
        data: { lastError },
      });
    } catch (error) {
      this.logger.warn({
        message: 'Failed to store Gmail sync error',
        connectionId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
