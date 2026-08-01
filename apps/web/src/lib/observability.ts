/**
 * Minimal observability bootstrap.
 * Sentry (or another client SDK) is only initialized when VITE_SENTRY_DSN is set.
 * Keep PII/token scrubbing and lead-content redaction in the real SDK config —
 * this stub never loads a third-party script without an explicit DSN.
 */
export function initObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (typeof dsn !== 'string' || dsn.trim().length === 0) {
    return;
  }

  // Stub: replace with `@sentry/react` init when the dependency is approved.
  // Intentionally a no-op beyond acknowledging the DSN so builds stay light.
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[observability] VITE_SENTRY_DSN present; Sentry init stub (no SDK loaded)');
  }
}

export function captureClientError(error: unknown, context?: Record<string, unknown>): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (typeof dsn !== 'string' || dsn.trim().length === 0) {
    return;
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[observability] captureClientError stub', error, context);
  }
}
