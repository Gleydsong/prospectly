const REDACTED = '[redacted]';

const SENSITIVE_KEY =
  /authorization|cookie|set-cookie|access[_-]?token|refresh[_-]?token|password|secret|email|phone|whatsapp|campaign|message|lead|payload|body|dsn/i;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._-]+/gi;

export type SentryLikeEvent = {
  request?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string> | string;
    query_string?: string | Record<string, string> | Array<{ key: string; value: string }>;
    data?: unknown;
  };
  user?: { email?: string | null; ip_address?: string; username?: string; id?: string };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: {
    values?: Array<{ category?: string; data?: Record<string, unknown>; message?: string }>;
  };
};

function redactString(value: string): string {
  return value
    .replace(BEARER_RE, 'Bearer [redacted]')
    .replace(EMAIL_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

function redactUnknown(value: unknown, depth = 0): unknown {
  if (depth > 4) return REDACTED;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => redactUnknown(item, depth + 1));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactUnknown(nested, depth + 1);
    }
    return output;
  }
  return value;
}

export function sanitizeSentryEvent<T extends SentryLikeEvent>(event: T): T {
  const next = { ...event };

  if (next.request) {
    const rawHeaders = next.request.headers;
    const headers: Record<string, string> = {};
    if (rawHeaders && typeof rawHeaders === 'object' && !Array.isArray(rawHeaders)) {
      for (const [key, headerValue] of Object.entries(rawHeaders as Record<string, unknown>)) {
        headers[key] = SENSITIVE_KEY.test(key) ? REDACTED : String(headerValue ?? '');
      }
    }
    next.request = {
      ...next.request,
      headers,
      cookies: undefined,
      data: undefined,
      query_string: undefined,
    };
  }

  if (next.user) {
    next.user = {
      ...next.user,
      email: undefined,
      ip_address: undefined,
      username: undefined,
    };
  }

  if (next.extra) {
    next.extra = redactUnknown(next.extra) as Record<string, unknown>;
  }

  if (next.contexts) {
    next.contexts = redactUnknown(next.contexts) as Record<string, unknown>;
  }

  if (next.breadcrumbs?.values) {
    next.breadcrumbs = {
      values: next.breadcrumbs.values.slice(-20).map((crumb) => ({
        ...crumb,
        message: typeof crumb.message === 'string' ? redactString(crumb.message) : crumb.message,
        data: crumb.data
          ? (redactUnknown({
              ...crumb.data,
              body: undefined,
              request_body: undefined,
              response_body: undefined,
              Authorization: undefined,
            }) as Record<string, unknown>)
          : undefined,
      })),
    };
  }

  return next;
}

export function sanitizeCaptureContext(
  context?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  return redactUnknown(context) as Record<string, unknown>;
}
