const BLOCKED_KEY =
  /password|token|secret|authorization|cookie|cpf|cnpj|email|phone|whatsapp|address|credit.?card|api[_-]?key|private.?key|refresh/i;

const COMPANY_ALLOWLIST = [
  'companyName',
  'category',
  'city',
  'state',
  'rating',
  'reviewCount',
  'websitePresence',
] as const;

export const LLM_FORBIDDEN_SENTINEL = 'LGPD_TEST_SECRET_123456';

export function sanitizeCompanyForLlm(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of COMPANY_ALLOWLIST) {
    if (raw[key] !== undefined) {
      out[key] = raw[key];
    }
  }
  return out;
}

export function findBlockedLlmKeys(value: unknown, path = ''): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBlockedLlmKeys(item, `${path}[${index}]`));
  }
  if (typeof value !== 'object') return [];
  const leaked: string[] = [];
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (BLOCKED_KEY.test(key)) {
      leaked.push(next);
      continue;
    }
    leaked.push(...findBlockedLlmKeys(nested, next));
  }
  return leaked;
}

export function sanitizeLlmPayload(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeLlmPayload(item));
  if (typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (BLOCKED_KEY.test(key)) continue;
    out[key] = sanitizeLlmPayload(nested);
  }
  return out;
}
