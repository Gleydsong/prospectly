import { BadGatewayException, Injectable } from '@nestjs/common';

import { CALENDAR_SYNC_MAX_EVENTS } from './communications.constants';
import {
  CALENDAR_API_DISABLED,
  CALENDAR_LIST_FAILED,
  googleApiFailureCode,
} from './google-api-error';
import type { CalendarEventMetadata, CalendarPort } from './calendar.port';
import { normalizeEmail } from './match-lead-email';

type CalendarListResponse = {
  items?: CalendarApiEvent[];
  nextPageToken?: string;
};

type CalendarApiEvent = {
  id?: string;
  status?: string;
  summary?: string;
  htmlLink?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: Array<{ email?: string; responseStatus?: string }>;
};

@Injectable()
export class CalendarHttpAdapter implements CalendarPort {
  async listEvents(input: {
    accessToken: string;
    timeMin: Date;
    timeMax: Date;
  }): Promise<CalendarEventMetadata[]> {
    const events: CalendarEventMetadata[] = [];
    let pageToken: string | undefined;
    while (events.length < CALENDAR_SYNC_MAX_EVENTS) {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin: input.timeMin.toISOString(),
        timeMax: input.timeMax.toISOString(),
        maxResults: '100',
        fields:
          'nextPageToken,items(id,status,summary,htmlLink,location,start,organizer(email),attendees(email,responseStatus))',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${input.accessToken}` } },
      );
      if (!res.ok) {
        throw new BadGatewayException(
          await googleApiFailureCode(res, CALENDAR_LIST_FAILED, CALENDAR_API_DISABLED),
        );
      }
      const body = (await res.json()) as CalendarListResponse;
      for (const item of body.items ?? []) {
        const parsed = parseCalendarEvent(item);
        if (parsed) events.push(parsed);
        if (events.length >= CALENDAR_SYNC_MAX_EVENTS) break;
      }
      if (!body.nextPageToken || events.length >= CALENDAR_SYNC_MAX_EVENTS) break;
      pageToken = body.nextPageToken;
    }
    return events;
  }
}

export function parseCalendarEvent(item: CalendarApiEvent): CalendarEventMetadata | null {
  if (!item.id || item.status === 'cancelled') return null;
  const occurredAt = parseEventStart(item.start);
  if (!occurredAt) return null;
  const attendees = (item.attendees ?? [])
    .filter((row): row is { email: string; responseStatus?: string } => Boolean(row.email))
    .map((row) => ({
      email: normalizeEmail(row.email),
      responseStatus: row.responseStatus ?? '',
    }));
  return {
    externalId: item.id,
    occurredAt,
    status: item.status ?? 'confirmed',
    organizerEmail: item.organizer?.email ? normalizeEmail(item.organizer.email) : '',
    attendees,
    subject: item.summary ?? '',
    snippet: item.location ?? '',
    htmlLink: item.htmlLink ?? '',
  };
}

function parseEventStart(start?: { dateTime?: string; date?: string }): Date | null {
  if (start?.dateTime) {
    const parsed = new Date(start.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (start?.date && /^\d{4}-\d{2}-\d{2}$/.test(start.date)) {
    return new Date(`${start.date}T00:00:00.000Z`);
  }
  return null;
}
