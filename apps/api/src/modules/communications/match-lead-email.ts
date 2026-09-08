export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractEmailsFromHeader(headerValue: string | undefined | null): string[] {
  if (!headerValue) return [];
  const matches = headerValue.match(EMAIL_RE) ?? [];
  return [...new Set(matches.map(normalizeEmail))];
}

export function matchLeadIdsForAddresses(input: {
  addresses: string[];
  leadIdByEmail: Map<string, string>;
  contactLeadIdsByEmail: Map<string, string[]>;
}): string[] {
  const matched = new Set<string>();
  for (const raw of input.addresses) {
    const email = normalizeEmail(raw);
    if (!email) continue;
    const leadId = input.leadIdByEmail.get(email);
    if (leadId) {
      matched.add(leadId);
      continue;
    }
    const uniqueContactLeads = [...new Set(input.contactLeadIdsByEmail.get(email) ?? [])];
    if (uniqueContactLeads.length === 1) {
      matched.add(uniqueContactLeads[0]!);
    }
  }
  return [...matched];
}

export function directionFromSender(
  fromAddresses: string[],
  connectionEmail: string,
): 'IN' | 'OUT' {
  const connected = normalizeEmail(connectionEmail);
  return fromAddresses.some((address) => normalizeEmail(address) === connected) ? 'OUT' : 'IN';
}

export function connectionIsOrganizerOrAccepted(input: {
  connectionEmail: string;
  organizerEmail?: string;
  attendees: Array<{ email: string; responseStatus?: string }>;
}): boolean {
  const connected = normalizeEmail(input.connectionEmail);
  if (!connected) return false;
  if (input.organizerEmail && normalizeEmail(input.organizerEmail) === connected) {
    return true;
  }
  return input.attendees.some(
    (attendee) =>
      normalizeEmail(attendee.email) === connected && attendee.responseStatus === 'accepted',
  );
}
