import { getApiErrorCode } from '@/lib/api';

export const REPORTS_QUERY_TIMEOUT_CODE = 'REPORTS_QUERY_TIMEOUT';

export function isReportsUnavailableError(error: unknown): boolean {
  return getApiErrorCode(error) === REPORTS_QUERY_TIMEOUT_CODE;
}
