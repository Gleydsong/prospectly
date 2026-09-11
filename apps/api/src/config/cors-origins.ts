/** Origins the production app/landing already use. CORS still comes from CORS_ORIGINS env. */
export const CANONICAL_APP_ORIGIN = 'https://app.prospectlyonboard.com';
export const CANONICAL_LANDING_ORIGIN = 'https://prospectlyonboard.com';
export const CANONICAL_API_ORIGIN = 'https://api.prospectlyonboard.com';
/** Host onrender da API — subdomínio público desligado (404). Não usar em env de produção. */
export const LEGACY_API_ORIGIN = 'https://prospectly-api.onrender.com';

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsAllowlistAccepts(origins: readonly string[], origin: string): boolean {
  return origins.includes(origin);
}
