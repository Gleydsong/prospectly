export const ORGANIZATION_FLAG_KEYS = ['saved_report'] as const;

export type OrganizationFlagKey = (typeof ORGANIZATION_FLAG_KEYS)[number];

export function isOrganizationFlagKey(value: string): value is OrganizationFlagKey {
  return (ORGANIZATION_FLAG_KEYS as readonly string[]).includes(value);
}
