import { createHash, timingSafeEqual } from 'node:crypto';

export const MCP_SCOPE = 'prospectly.plugin.read';

export function hashOpaque(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.hash.length > 0) return false;
  if (parsed.username || parsed.password) return false;

  if (parsed.protocol === 'https:') return true;
  if (parsed.protocol !== 'http:') return false;

  return (
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === 'localhost' ||
    parsed.hostname === '::1' ||
    parsed.hostname === '[::1]'
  );
}

export function verifyPkceS256(verifier: string, challenge: string): boolean {
  if (!verifier || !challenge) return false;
  const computed = createHash('sha256').update(verifier).digest('base64url');
  const left = Buffer.from(computed);
  const right = Buffer.from(challenge);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function buildWwwAuthenticate(resourceMetadataUrl: string): string {
  return `Bearer realm="prospectly", resource_metadata="${resourceMetadataUrl}"`;
}

export function issuerFromMcpResource(resource: string): string {
  const url = new URL(resource);
  return `${url.protocol}//${url.host}`;
}

export function protectedResourceMetadataUrl(issuer: string): string {
  return `${issuer}/.well-known/oauth-protected-resource`;
}

export function buildProtectedResourceMetadata(resource: string, issuer: string) {
  return {
    resource,
    authorization_servers: [issuer],
    scopes_supported: [MCP_SCOPE],
    bearer_methods_supported: ['header'] as const,
  };
}

export function buildAuthorizationServerMetadata(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/v1/oauth/authorize`,
    token_endpoint: `${issuer}/api/v1/oauth/token`,
    registration_endpoint: `${issuer}/api/v1/oauth/register`,
    revocation_endpoint: `${issuer}/api/v1/oauth/revoke`,
    code_challenge_methods_supported: ['S256'] as const,
    grant_types_supported: ['authorization_code', 'refresh_token'] as const,
    response_types_supported: ['code'] as const,
    token_endpoint_auth_methods_supported: ['none'] as const,
    scopes_supported: [MCP_SCOPE],
  };
}

export function parseMcpBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, extra] = header.split(' ');
  if (scheme !== 'Bearer' || !token || extra) return null;
  return token;
}

export function isMcpAccessToken(token: string): boolean {
  return token.startsWith('mca_');
}
