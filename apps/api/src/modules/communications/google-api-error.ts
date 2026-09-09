export const GMAIL_API_DISABLED = 'gmail_api_disabled';
export const CALENDAR_API_DISABLED = 'calendar_api_disabled';
export const GMAIL_LIST_FAILED = 'gmail_list_failed';
export const CALENDAR_LIST_FAILED = 'calendar_list_failed';
export const GOOGLE_TOKEN_REFRESH_FAILED = 'google_token_refresh_failed';
export const GMAIL_SYNC_FAILED = 'gmail_sync_failed';

export const PUBLIC_SYNC_ERROR_CODES = [
  GMAIL_API_DISABLED,
  CALENDAR_API_DISABLED,
  GMAIL_LIST_FAILED,
  CALENDAR_LIST_FAILED,
  GOOGLE_TOKEN_REFRESH_FAILED,
  GMAIL_SYNC_FAILED,
] as const;

const PUBLIC_SYNC_ERROR_CODE_SET = new Set<string>(PUBLIC_SYNC_ERROR_CODES);

const LEGACY_SYNC_ERROR_MESSAGES: Record<string, string> = {
  'Gmail list failed': GMAIL_LIST_FAILED,
  'Calendar list failed': CALENDAR_LIST_FAILED,
  'Google token refresh failed': GOOGLE_TOKEN_REFRESH_FAILED,
};

const DISABLED_REASONS = new Set(['accessNotConfigured', 'SERVICE_DISABLED', 'API_DISABLED']);

type GoogleErrorBody = {
  error?: {
    message?: string;
    status?: string;
    details?: Array<{ reason?: string }>;
    errors?: Array<{ reason?: string }>;
  };
};

export function toPublicSyncErrorCode(raw: string | null | undefined): string {
  if (!raw) return GMAIL_SYNC_FAILED;
  if (PUBLIC_SYNC_ERROR_CODE_SET.has(raw)) return raw;
  return LEGACY_SYNC_ERROR_MESSAGES[raw] ?? GMAIL_SYNC_FAILED;
}

export async function googleApiFailureCode(
  res: Response,
  fallback: string,
  disabledCode: string,
): Promise<string> {
  try {
    const body = (await res.json()) as GoogleErrorBody;
    const reasons = [
      ...(body.error?.details ?? []).map((row) => row.reason),
      ...(body.error?.errors ?? []).map((row) => row.reason),
    ].filter((reason): reason is string => Boolean(reason));
    const message = body.error?.message ?? '';
    if (
      reasons.some((reason) => DISABLED_REASONS.has(reason)) ||
      /has not been used in project/i.test(message) ||
      /API has not been used/i.test(message) ||
      /API is not enabled/i.test(message)
    ) {
      return disabledCode;
    }
  } catch {
    return fallback;
  }
  return fallback;
}
