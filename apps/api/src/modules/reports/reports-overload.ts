import { ServiceUnavailableException } from '@nestjs/common';

export const REPORTS_QUERY_TIMEOUT_CODE = 'REPORTS_QUERY_TIMEOUT';
export const REPORTS_STATEMENT_TIMEOUT_MS = 8_000;
export const REPORTS_POOL_MAX_WAIT_MS = 5_000;
export const REPORTS_UNAVAILABLE_MESSAGE = 'Relatórios indisponível. Tente de novo.';

export function isReportsOverloadError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'P2028' || code === 'P2024') return true;
  }
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /P2028|P2024|statement timeout|timed out fetching a new connection|canceling statement/i.test(
    message,
  );
}

export function reportsUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: REPORTS_QUERY_TIMEOUT_CODE,
    message: REPORTS_UNAVAILABLE_MESSAGE,
  });
}
