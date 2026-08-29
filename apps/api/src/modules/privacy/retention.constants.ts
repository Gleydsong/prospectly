export const PRIVACY_RETENTION_QUEUE = 'privacy-retention';
export const PROCESS_PRIVACY_RETENTION_JOB = 'process-privacy-retention';

export const RETENTION = {
  revokedRefreshTokenDays: 30,
  expiredRefreshTokenDays: 7,
  completedImportErrorDays: 30,
  expiredAuthTokenClearMs: 0,
} as const;
