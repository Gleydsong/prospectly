import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GMAIL_SYNC_MAX_MESSAGES } from './communications.constants';
import type { GmailMessageMetadata, GmailPort } from './gmail.port';
import { extractEmailsFromHeader } from './match-lead-email';

type GmailListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
};

type GmailMessageResponse = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: { headers?: Array<{ name?: string; value?: string }> };
};

@Injectable()
export class GmailHttpAdapter implements GmailPort {
  constructor(private readonly config: ConfigService) {}

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const clientId = this.config.get<string>('google.clientId') ?? '';
    const clientSecret = this.config.get<string>('google.clientSecret') ?? '';
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) {
      throw new BadGatewayException('Google token refresh failed');
    }
    const tokens = (await res.json()) as { access_token?: string };
    if (!tokens.access_token) {
      throw new BadGatewayException('Google token refresh failed');
    }
    return tokens.access_token;
  }

  async listMessages(input: { accessToken: string; after: Date }): Promise<GmailMessageMetadata[]> {
    const afterUnix = Math.floor(input.after.getTime() / 1000);
    const ids: Array<{ id: string }> = [];
    let pageToken: string | undefined;
    while (ids.length < GMAIL_SYNC_MAX_MESSAGES) {
      const params = new URLSearchParams({
        q: `(in:inbox OR in:sent) after:${afterUnix}`,
        maxResults: '100',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
        { headers: { Authorization: `Bearer ${input.accessToken}` } },
      );
      if (!listRes.ok) {
        throw new BadGatewayException('Gmail list failed');
      }
      const list = (await listRes.json()) as GmailListResponse;
      for (const row of list.messages ?? []) {
        if (row.id) ids.push({ id: row.id });
        if (ids.length >= GMAIL_SYNC_MAX_MESSAGES) break;
      }
      if (!list.nextPageToken || ids.length >= GMAIL_SYNC_MAX_MESSAGES) break;
      pageToken = list.nextPageToken;
    }

    const messages: GmailMessageMetadata[] = [];
    for (const row of ids) {
      const msg = await this.getMetadata(input.accessToken, row.id);
      if (msg) messages.push(msg);
    }
    return messages;
  }

  private async getMetadata(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessageMetadata | null> {
    const params = new URLSearchParams({ format: 'metadata' });
    for (const header of ['From', 'To', 'Cc', 'Subject']) {
      params.append('metadataHeaders', header);
    }
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as GmailMessageResponse;
    if (!body.id) return null;
    const headers = new Map<string, string>();
    for (const header of body.payload?.headers ?? []) {
      if (!header.name || header.value === undefined) continue;
      headers.set(header.name.toLowerCase(), header.value);
    }
    const occurredAt = body.internalDate ? new Date(Number(body.internalDate)) : new Date();
    const threadId = body.threadId ?? body.id;
    return {
      externalId: body.id,
      threadId,
      occurredAt,
      from: extractEmailsFromHeader(headers.get('from')),
      to: extractEmailsFromHeader(headers.get('to')),
      cc: extractEmailsFromHeader(headers.get('cc')),
      subject: headers.get('subject') ?? '',
      snippet: body.snippet ?? '',
      htmlLink: `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(threadId)}`,
    };
  }
}
