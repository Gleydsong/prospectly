import { createHash, timingSafeEqual } from 'node:crypto';

import { InvalidSdrSecurityError } from './sdr-errors';

export function assertTenantAccess(
  actorOrganizationId: string,
  resourceOrganizationId: string,
): void {
  if (
    actorOrganizationId.trim() === '' ||
    resourceOrganizationId.trim() === '' ||
    actorOrganizationId !== resourceOrganizationId
  ) {
    throw new InvalidSdrSecurityError('tenant access denied');
  }
}

export class SdrRateLimit {
  private readonly counts = new Map<string, number>();

  constructor(private readonly limit: number) {}

  take(organizationId: string): boolean {
    const used = this.counts.get(organizationId) ?? 0;
    if (used >= this.limit) return false;
    this.counts.set(organizationId, used + 1);
    return true;
  }
}

export function readUntrustedText(text: string): { data: string; authorizesSend: false } {
  return { data: text, authorizesSend: false };
}

export function webhookSecretMatches(provided: string, expected: string): boolean {
  if (provided.trim() === '' || expected.trim() === '') return false;
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}
