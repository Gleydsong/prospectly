import { sanitizeMailtoHref } from './safe-url';

export const SUPPORT_EMAIL = 'support@prospectlyonboard.com';

export function buildSupportMailto(input: {
  subject: string;
  details: string;
  fromName?: string;
  fromEmail?: string;
}): string | null {
  const base = sanitizeMailtoHref(SUPPORT_EMAIL);
  if (!base) {
    return null;
  }

  const subject = input.subject.trim().slice(0, 200);
  const details = input.details.trim().slice(0, 4000);
  if (!subject || !details) {
    return null;
  }

  const account =
    input.fromEmail != null && input.fromEmail.length > 0
      ? `\n\nConta: ${[input.fromName, `<${input.fromEmail}>`].filter(Boolean).join(' ')}`
      : '';

  return `${base}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${details}${account}`)}`;
}
