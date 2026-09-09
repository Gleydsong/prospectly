import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { PrismaService } from '../../common/prisma/prisma.service';
import { runWithBypass } from '../../common/prisma/tenant-context';
import { isDuplicateJobError, replaceFinishedDurableJob } from '../../common/workers/durable-job';
import { decryptRefreshToken } from '../google-connections/token-crypto';
import { CommunicationsService } from './communications.service';
import {
  CALENDAR_FUTURE_WINDOW_MS,
  GMAIL_BACKFILL_MS,
  GMAIL_INCREMENTAL_OVERLAP_MS,
  GMAIL_SYNC_JOB_OPTIONS,
  GMAIL_SYNC_QUEUE,
  SYNC_GMAIL_CONNECTION_JOB,
  type SyncGmailConnectionJobData,
} from './communications.constants';
import { CALENDAR_PORT, type CalendarEventMetadata, type CalendarPort } from './calendar.port';
import { GMAIL_PORT, type GmailMessageMetadata, type GmailPort } from './gmail.port';
import { GMAIL_SYNC_FAILED, toPublicSyncErrorCode } from './google-api-error';
import {
  connectionIsOrganizerOrAccepted,
  directionFromSender,
  matchLeadIdsForAddresses,
  normalizeEmail,
} from './match-lead-email';

@Injectable()
export class GmailIngestService {
  private readonly logger = new Logger(GmailIngestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly communications: CommunicationsService,
    @Inject(GMAIL_PORT) private readonly gmail: GmailPort,
    @Inject(CALENDAR_PORT) private readonly calendar: CalendarPort,
    @InjectQueue(GMAIL_SYNC_QUEUE)
    private readonly queue: Queue<SyncGmailConnectionJobData>,
  ) {}

  async enqueueConnection(
    organizationId: string,
    connectionId: string,
    correlationId?: string,
  ): Promise<boolean> {
    const jobId = `gmail-sync-${connectionId}`;
    const existing = await this.queue.getJob(jobId);
    if ((await replaceFinishedDurableJob(existing)) === 'busy') {
      return false;
    }
    try {
      await this.queue.add(
        SYNC_GMAIL_CONNECTION_JOB,
        { organizationId, connectionId, correlationId },
        { ...GMAIL_SYNC_JOB_OPTIONS, jobId },
      );
      return true;
    } catch (error) {
      if (!isDuplicateJobError(error)) throw error;
      return false;
    }
  }

  async sweepActiveConnections(): Promise<void> {
    const rows = await runWithBypass(() =>
      this.prisma.googleConnection.findMany({
        where: { revokedAt: null, refreshTokenEncrypted: { not: null } },
        select: { id: true, organizationId: true },
      }),
    );
    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      if (await this.enqueueConnection(row.organizationId, row.id)) added += 1;
      else skipped += 1;
    }
    this.logger.log({
      message: 'Gmail sync sweep enqueued',
      connections: rows.length,
      added,
      skipped,
    });
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
      const events = await this.calendar.listEvents({
        accessToken,
        timeMin: after,
        timeMax: new Date(now.getTime() + CALENDAR_FUTURE_WINDOW_MS),
      });
      const maps = await this.loadMatchMaps(
        organizationId,
        [
          ...messages.flatMap((message) => [...message.from, ...message.to, ...message.cc]),
          ...events.flatMap((event) => [
            event.organizerEmail,
            ...event.attendees.map((attendee) => attendee.email),
          ]),
        ],
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
      for (const event of events) {
        await this.persistMatchedEvent(
          organizationId,
          connection.id,
          connection.googleEmail,
          event,
          maps,
          now,
        );
      }
      await this.prisma.googleConnection.update({
        where: { id: connection.id },
        data: { lastSyncAt: now, lastError: null },
      });
    } catch (error) {
      const message = publicSyncErrorCode(error);
      await this.markError(connection.id, message);
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

  private async persistMatchedEvent(
    organizationId: string,
    connectionId: string,
    connectionEmail: string,
    event: CalendarEventMetadata,
    maps: {
      leadIdByEmail: Map<string, string>;
      contactLeadIdsByEmail: Map<string, string[]>;
    },
    now: Date,
  ): Promise<void> {
    if (event.status === 'cancelled') return;
    if (
      !connectionIsOrganizerOrAccepted({
        connectionEmail,
        organizerEmail: event.organizerEmail,
        attendees: event.attendees,
      })
    ) {
      return;
    }
    const leadIds = matchLeadIdsForAddresses({
      addresses: [event.organizerEmail, ...event.attendees.map((attendee) => attendee.email)],
      leadIdByEmail: maps.leadIdByEmail,
      contactLeadIdsByEmail: maps.contactLeadIdsByEmail,
    });
    const from = event.organizerEmail ? [event.organizerEmail] : [];
    const to = event.attendees
      .map((attendee) => attendee.email)
      .filter((email) => email && email !== event.organizerEmail);
    for (const leadId of leadIds) {
      await this.communications.persistEvent({
        organizationId,
        leadId,
        connectionId,
        externalId: event.externalId,
        occurredAt: event.occurredAt,
        from,
        to,
        cc: [],
        subject: event.subject,
        snippet: event.snippet,
        htmlLink: event.htmlLink,
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
        data: { lastError: toPublicSyncErrorCode(lastError) },
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

export function publicSyncErrorCode(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (typeof response === 'string') return toPublicSyncErrorCode(response);
    if (typeof response === 'object' && response && 'message' in response) {
      const message = (response as { message: unknown }).message;
      if (typeof message === 'string') return toPublicSyncErrorCode(message);
    }
  }
  return GMAIL_SYNC_FAILED;
}
