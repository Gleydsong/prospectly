const STORAGE_KEY = 'prospectly.correlationId';

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Session-scoped correlation id for support / error recovery UI. */
export function getOrCreateCorrelationId(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const next = createId();
    sessionStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return createId();
  }
}

export function readCorrelationIdFromError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const record = error as { correlationId?: unknown; cause?: unknown };
  if (typeof record.correlationId === 'string' && record.correlationId.length > 0) {
    return record.correlationId;
  }
  if (record.cause && typeof record.cause === 'object') {
    const causeId = (record.cause as { correlationId?: unknown }).correlationId;
    if (typeof causeId === 'string' && causeId.length > 0) return causeId;
  }
  return undefined;
}
