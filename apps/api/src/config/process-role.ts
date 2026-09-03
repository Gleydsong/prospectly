export type ProcessRole = 'api' | 'worker';

export function parseProcessRole(config: Record<string, unknown>): ProcessRole {
  const raw = config.ROLE;
  if (raw === undefined || raw === '') {
    return 'api';
  }
  if (raw === 'api' || raw === 'worker') {
    return raw;
  }
  throw new Error('ROLE must be api or worker');
}
