import { resolveSentryDsn } from '@/lib/public-env';
import { sanitizeCaptureContext, sanitizeSentryEvent } from '@/lib/observability-sanitize';

type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
const pending: Array<(sdk: SentryModule) => void> = [];

function flushPending(sdk: SentryModule): void {
  while (pending.length > 0) {
    const task = pending.shift();
    task?.(sdk);
  }
}

/**
 * Loads @sentry/react only when a valid public DSN is present.
 * Never throws — a missing or invalid DSN leaves the app running without reporting.
 */
export function initObservability(): void {
  const dsn = resolveSentryDsn();
  if (!dsn) return;

  void import('@sentry/react')
    .then((mod) => {
      mod.init({
        dsn,
        environment: import.meta.env.MODE,
        release: 'prospectly-web@0.1.0',
        sendDefaultPii: false,
        tracesSampleRate: 0,
        maxBreadcrumbs: 20,
        beforeSend(event) {
          return sanitizeSentryEvent(
            event as Parameters<typeof sanitizeSentryEvent>[0],
          ) as typeof event;
        },
        beforeBreadcrumb(breadcrumb) {
          if (
            breadcrumb.category === 'xhr' ||
            breadcrumb.category === 'fetch' ||
            breadcrumb.category === 'http'
          ) {
            const data = { ...(breadcrumb.data ?? {}) };
            delete data.body;
            delete data.request_body;
            delete data.response_body;
            if (typeof data.Authorization === 'string') data.Authorization = '[redacted]';
            breadcrumb.data = data;
          }
          if (typeof breadcrumb.message === 'string') {
            breadcrumb.message = breadcrumb.message.replace(
              /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
              '[redacted]',
            );
          }
          return breadcrumb;
        },
      });
      sentry = mod;
      flushPending(mod);
    })
    .catch(() => {
      sentry = null;
    });
}

export function captureClientError(error: unknown, context?: Record<string, unknown>): void {
  if (!resolveSentryDsn()) return;

  const extras = sanitizeCaptureContext(context);
  const send = (sdk: SentryModule) => {
    sdk.captureException(error, extras ? { extra: extras } : undefined);
  };

  if (sentry) {
    send(sentry);
    return;
  }

  pending.push(send);
}
