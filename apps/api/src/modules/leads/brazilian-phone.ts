export type BrazilianPhoneKind = 'mobile' | 'landline' | 'unknown';

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Classifies a Brazilian number after ANATEL rules:
 * mobile = DDD (2) + 9 + 8 digits; landline = DDD + 8 digits.
 */
export function classifyBrazilianPhone(raw: string | null | undefined): BrazilianPhoneKind {
  if (!raw?.trim()) return 'unknown';
  let digits = digitsOnly(raw);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits[2] === '9') return 'mobile';
  if (digits.length === 10) return 'landline';
  return 'unknown';
}

export function hasLikelyWhatsApp(input: {
  phone?: string | null;
  whatsapp?: string | null;
}): boolean {
  if (input.whatsapp?.trim()) return true;
  return classifyBrazilianPhone(input.phone) === 'mobile';
}
