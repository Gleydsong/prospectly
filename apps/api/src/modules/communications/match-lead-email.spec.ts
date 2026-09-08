import {
  connectionIsOrganizerOrAccepted,
  directionFromSender,
  extractEmailsFromHeader,
  matchLeadIdsForAddresses,
  normalizeEmail,
} from './match-lead-email';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Ana@Acme.com ')).toBe('ana@acme.com');
  });
});

describe('extractEmailsFromHeader', () => {
  it('pulls addresses out of display-name headers', () => {
    expect(extractEmailsFromHeader('Ana Silva <Ana@Acme.com>, bruno@acme.com')).toEqual([
      'ana@acme.com',
      'bruno@acme.com',
    ]);
  });

  it('returns nothing for empty or nameless values', () => {
    expect(extractEmailsFromHeader(undefined)).toEqual([]);
    expect(extractEmailsFromHeader('Equipa comercial')).toEqual([]);
  });
});

describe('matchLeadIdsForAddresses', () => {
  const leadIdByEmail = new Map([['lead@acme.com', 'lead-1']]);
  const contactLeadIdsByEmail = new Map<string, string[]>([
    ['unique@acme.com', ['lead-2']],
    ['shared@acme.com', ['lead-3', 'lead-4']],
  ]);

  it('matches Lead.email exactly and ignores company domain', () => {
    expect(
      matchLeadIdsForAddresses({
        addresses: ['lead@acme.com', 'noreply@acme.com'],
        leadIdByEmail,
        contactLeadIdsByEmail,
      }),
    ).toEqual(['lead-1']);
  });

  it('matches a unique LeadContact email when Lead.email misses', () => {
    expect(
      matchLeadIdsForAddresses({
        addresses: ['unique@acme.com'],
        leadIdByEmail,
        contactLeadIdsByEmail,
      }),
    ).toEqual(['lead-2']);
  });

  it('discards a contact email shared by two leads', () => {
    expect(
      matchLeadIdsForAddresses({
        addresses: ['shared@acme.com'],
        leadIdByEmail,
        contactLeadIdsByEmail,
      }),
    ).toEqual([]);
  });

  it('prefers Lead.email when the same address is also a contact on another lead', () => {
    const contacts = new Map<string, string[]>([['lead@acme.com', ['lead-9']]]);
    expect(
      matchLeadIdsForAddresses({
        addresses: ['lead@acme.com'],
        leadIdByEmail,
        contactLeadIdsByEmail: contacts,
      }),
    ).toEqual(['lead-1']);
  });
});

describe('directionFromSender', () => {
  it('marks outbound when the connected mailbox is From', () => {
    expect(directionFromSender(['Ana@Gmail.com'], 'ana@gmail.com')).toBe('OUT');
    expect(directionFromSender(['lead@acme.com'], 'ana@gmail.com')).toBe('IN');
  });
});

describe('connectionIsOrganizerOrAccepted', () => {
  it('accepts the connected organizer regardless of attendee RSVP', () => {
    expect(
      connectionIsOrganizerOrAccepted({
        connectionEmail: 'Ana@Gmail.com',
        organizerEmail: 'ana@gmail.com',
        attendees: [{ email: 'lead@acme.com', responseStatus: 'needsAction' }],
      }),
    ).toBe(true);
  });

  it('accepts when the connected person RSVP accepted', () => {
    expect(
      connectionIsOrganizerOrAccepted({
        connectionEmail: 'ana@gmail.com',
        organizerEmail: 'lead@acme.com',
        attendees: [{ email: 'Ana@Gmail.com', responseStatus: 'accepted' }],
      }),
    ).toBe(true);
  });

  it('rejects declined, tentative and unanswered invites', () => {
    for (const responseStatus of ['declined', 'tentative', 'needsAction']) {
      expect(
        connectionIsOrganizerOrAccepted({
          connectionEmail: 'ana@gmail.com',
          organizerEmail: 'lead@acme.com',
          attendees: [{ email: 'ana@gmail.com', responseStatus }],
        }),
      ).toBe(false);
    }
  });
});
