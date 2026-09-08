import { parseCalendarEvent } from './calendar.adapter';

describe('parseCalendarEvent', () => {
  it('expands timed instances and omits cancelled events', () => {
    expect(
      parseCalendarEvent({
        id: 'evt-1',
        status: 'confirmed',
        summary: 'Kickoff',
        htmlLink: 'https://www.google.com/calendar/event?eid=evt-1',
        location: 'Sala 2',
        start: { dateTime: '2026-08-20T09:00:00.000Z' },
        organizer: { email: 'Ana@Gmail.com' },
        attendees: [{ email: 'Lead@Acme.com', responseStatus: 'accepted' }],
      }),
    ).toEqual({
      externalId: 'evt-1',
      occurredAt: new Date('2026-08-20T09:00:00.000Z'),
      status: 'confirmed',
      organizerEmail: 'ana@gmail.com',
      attendees: [{ email: 'lead@acme.com', responseStatus: 'accepted' }],
      subject: 'Kickoff',
      snippet: 'Sala 2',
      htmlLink: 'https://www.google.com/calendar/event?eid=evt-1',
    });
    expect(parseCalendarEvent({ id: 'x', status: 'cancelled', start: { date: '2026-08-20' } })).toBe(
      null,
    );
  });

  it('parses all-day start.date as UTC midnight without description body', () => {
    const parsed = parseCalendarEvent({
      id: 'evt-day',
      status: 'confirmed',
      summary: 'Feriado',
      start: { date: '2026-08-20' },
      organizer: { email: 'ana@gmail.com' },
    });
    expect(parsed?.occurredAt).toEqual(new Date('2026-08-20T00:00:00.000Z'));
    expect(parsed).not.toHaveProperty('description');
    expect(JSON.stringify(parsed)).not.toContain('description');
  });
});
