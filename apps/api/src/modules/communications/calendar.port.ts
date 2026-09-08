export const CALENDAR_PORT = 'CALENDAR_PORT';

export type CalendarAttendee = {
  email: string;
  responseStatus: string;
};

export type CalendarEventMetadata = {
  externalId: string;
  occurredAt: Date;
  status: string;
  organizerEmail: string;
  attendees: CalendarAttendee[];
  subject: string;
  snippet: string;
  htmlLink: string;
};

export interface CalendarPort {
  listEvents(input: {
    accessToken: string;
    timeMin: Date;
    timeMax: Date;
  }): Promise<CalendarEventMetadata[]>;
}
