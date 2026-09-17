import { createHash, randomBytes } from 'node:crypto';

import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  buildWwwAuthenticate,
  hashOpaque,
  isAllowedRedirectUri,
  isMcpAccessToken,
  issuerFromMcpResource,
  MCP_SCOPE,
  parseMcpBearer,
  verifyPkceS256,
} from './oauth-protocol';

function pkceChallengeS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

describe('oauth-protocol', () => {
  it('allows https and loopback redirect URIs and rejects open redirects', () => {
    expect(isAllowedRedirectUri('https://cursor.example/cb')).toBe(true);
    expect(isAllowedRedirectUri('http://127.0.0.1:10000/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:3000/cb')).toBe(true);
    expect(isAllowedRedirectUri('http://[::1]:8787/cb')).toBe(true);
    expect(isAllowedRedirectUri('cursor://anysphere.cursor-mcp/oauth/callback')).toBe(true);
    expect(isAllowedRedirectUri('https://www.cursor.com/agents/mcp/oauth/callback')).toBe(true);
    expect(isAllowedRedirectUri('http://localhost:8787/callback')).toBe(true);
    expect(isAllowedRedirectUri('cursor://evil.example/oauth/callback')).toBe(false);
    expect(isAllowedRedirectUri('http://evil.example/cb')).toBe(false);
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirectUri('https://cursor.example/cb#fragment')).toBe(false);
  });

  it('verifies PKCE S256 and rejects a wrong verifier', () => {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = pkceChallengeS256(verifier);
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256('wrong-verifier', challenge)).toBe(false);
  });

  it('hashes opaque secrets without storing plaintext', () => {
    const hashed = hashOpaque('pst_x');
    expect(hashed).toMatch(/^[a-f0-9]{64}$/);
    expect(hashed).not.toContain('pst_x');
    expect(hashed).toBe(createHash('sha256').update('pst_x').digest('hex'));
  });

  it('builds a Bearer WWW-Authenticate challenge with resource metadata', () => {
    const header = buildWwwAuthenticate(
      'https://api.example/.well-known/oauth-protected-resource',
    );
    expect(header).toContain('Bearer');
    expect(header).toContain(
      'resource_metadata="https://api.example/.well-known/oauth-protected-resource"',
    );
    expect(MCP_SCOPE).toBe('prospectly.plugin.read');
  });

  it('derives issuer and OAuth metadata from the MCP resource URL', () => {
    const issuer = issuerFromMcpResource('http://127.0.0.1:3000/mcp');
    expect(issuer).toBe('http://127.0.0.1:3000');
    const protectedResource = buildProtectedResourceMetadata('http://127.0.0.1:3000/mcp', issuer);
    expect(protectedResource.scopes_supported).toEqual(['prospectly.plugin.read']);
    expect(protectedResource.bearer_methods_supported).toEqual(['header']);
    const asMeta = buildAuthorizationServerMetadata(issuer);
    expect(asMeta.authorization_endpoint).toBe('http://127.0.0.1:3000/api/v1/oauth/authorize');
    expect(asMeta.code_challenge_methods_supported).toEqual(['S256']);
  });

  it('parses Bearer MCP tokens and rejects plugin or JWT credentials', () => {
    expect(parseMcpBearer('Bearer mca_abc')).toBe('mca_abc');
    expect(parseMcpBearer(undefined)).toBeNull();
    expect(isMcpAccessToken('mca_abc')).toBe(true);
    expect(isMcpAccessToken('pst_abc')).toBe(false);
    expect(isMcpAccessToken('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBe(false);
  });
});
