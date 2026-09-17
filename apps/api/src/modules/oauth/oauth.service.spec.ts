import { createHash } from 'node:crypto';

import { BadRequestException, ForbiddenException } from '@nestjs/common';

import { OauthService } from './oauth.service';
import { hashOpaque } from './oauth-protocol';

const MCP = 'http://127.0.0.1:3000/mcp';
const FRONTEND = 'http://localhost:5173';

function makeConfig() {
  return {
    get: jest.fn((key: string) => {
      if (key === 'mcpResourceUrl') return MCP;
      if (key === 'frontendUrl') return FRONTEND;
      return undefined;
    }),
  };
}

function makeClient() {
  return {
    id: 'client-1',
    clientName: 'Cursor',
    redirectUris: ['http://127.0.0.1:10000/cb'],
    tokenEndpointAuthMethod: 'none',
  };
}

describe('OauthService.registerClient', () => {
  it('rejects a non-loopback http redirect_uri', async () => {
    const prisma = { oauthClient: { create: jest.fn() } };
    const service = new OauthService(prisma as never, { get: jest.fn() } as never);

    await expect(
      service.registerClient({
        client_name: 'Cursor',
        redirect_uris: ['http://evil.example/cb'],
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'invalid_request' }) });
    expect(prisma.oauthClient.create).not.toHaveBeenCalled();
  });

  it('persists a public client for an https redirect_uri', async () => {
    const prisma = {
      oauthClient: {
        create: jest.fn().mockResolvedValue({
          id: 'client-1',
          clientName: 'Cursor',
          redirectUris: ['https://ok.example/cb'],
          tokenEndpointAuthMethod: 'none',
        }),
      },
    };
    const service = new OauthService(prisma as never, { get: jest.fn() } as never);

    const result = await service.registerClient({
      client_name: 'Cursor',
      redirect_uris: ['https://ok.example/cb'],
    });

    expect(result).toEqual({
      client_id: 'client-1',
      client_name: 'Cursor',
      redirect_uris: ['https://ok.example/cb'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    expect(prisma.oauthClient.create).toHaveBeenCalledWith({
      data: {
        clientName: 'Cursor',
        redirectUris: ['https://ok.example/cb'],
        tokenEndpointAuthMethod: 'none',
      },
    });
  });
});

describe('OauthService BadRequest shape', () => {
  it('uses BadRequestException', async () => {
    const service = new OauthService({ oauthClient: { create: jest.fn() } } as never, {
      get: jest.fn(),
    } as never);
    await expect(
      service.registerClient({ client_name: 'X', redirect_uris: ['ftp://x'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

const authorizeQuery = {
  client_id: 'client-1',
  redirect_uri: 'http://127.0.0.1:10000/cb',
  response_type: 'code',
  code_challenge: 'abc',
  code_challenge_method: 'S256',
  resource: MCP,
  scope: 'prospectly.plugin.read',
  state: 'xyz',
};

describe('OauthService.buildConsentRedirectUrl', () => {
  it('redirects the browser to the web consent page', async () => {
    const prisma = {
      oauthClient: { findUnique: jest.fn().mockResolvedValue(makeClient()) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    const location = await service.buildConsentRedirectUrl(authorizeQuery);
    expect(location.startsWith(`${FRONTEND}/oauth/consent?`)).toBe(true);
    expect(location).toContain('client_id=client-1');
    expect(location).toContain('state=xyz');
  });

  it('rejects a resource that is not the MCP URL', async () => {
    const prisma = {
      oauthClient: { findUnique: jest.fn().mockResolvedValue(makeClient()) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await expect(
      service.buildConsentRedirectUrl({ ...authorizeQuery, resource: 'https://evil.example/mcp' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'invalid_target' }) });
  });

  it('rejects a redirect_uri that is not registered', async () => {
    const prisma = {
      oauthClient: { findUnique: jest.fn().mockResolvedValue(makeClient()) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await expect(
      service.buildConsentRedirectUrl({
        ...authorizeQuery,
        redirect_uri: 'https://attacker.example/cb',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'invalid_request' }) });
  });
});

describe('OauthService.consent', () => {
  const consentInput = {
    ...authorizeQuery,
    organizationId: 'org-1',
    decision: 'allow' as const,
  };

  it('forbids a VIEWER membership on the chosen org', async () => {
    const prisma = {
      oauthClient: { findUnique: jest.fn().mockResolvedValue(makeClient()) },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'VIEWER' }),
      },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await expect(service.consent('user-1', consentInput)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns access_denied on the client redirect when the user denies', async () => {
    const prisma = {
      oauthClient: { findUnique: jest.fn().mockResolvedValue(makeClient()) },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'OWNER' }),
      },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    const result = await service.consent('user-1', { ...consentInput, decision: 'deny' });
    expect(result.redirect).toContain('error=access_denied');
    expect(result.redirect).toContain('state=xyz');
    expect(result.redirect.startsWith('http://127.0.0.1:10000/cb?')).toBe(true);
  });

  it('stores a hashed authorization code and a McpConnection on allow', async () => {
    const prisma = {
      oauthClient: { findUnique: jest.fn().mockResolvedValue(makeClient()) },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ role: 'ADMIN' }),
      },
      mcpConnection: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      },
      oauthAuthorizationCode: {
        create: jest.fn().mockResolvedValue({ id: 'code-row' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    const result = await service.consent('user-1', consentInput);
    const redirect = new URL(result.redirect);
    const code = redirect.searchParams.get('code');
    expect(code).toBeTruthy();
    expect(prisma.oauthAuthorizationCode.create).toHaveBeenCalled();
    const stored = prisma.oauthAuthorizationCode.create.mock.calls[0][0].data as {
      codeHash: string;
      codeChallenge: string;
    };
    expect(stored.codeHash).toBe(hashOpaque(code!));
    expect(stored.codeHash).not.toBe(code);
    expect(stored.codeChallenge).toBe('abc');
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'integration.mcp_connection.granted' }),
      }),
    );
  });
});

describe('OauthService.exchangeToken', () => {
  const verifier = 'test-pkce-verifier-value-32chars-min';
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const rawCode = 'mcc_plain_code';

  function codeRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'crow',
      codeHash: hashOpaque(rawCode),
      clientId: 'client-1',
      redirectUri: 'http://127.0.0.1:10000/cb',
      codeChallenge: challenge,
      resource: MCP,
      scope: 'prospectly.plugin.read',
      organizationId: 'org-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      connection: { id: 'conn-1', revokedAt: null },
      ...overrides,
    };
  }

  it('rejects a wrong PKCE verifier', async () => {
    const prisma = {
      oauthAuthorizationCode: { findUnique: jest.fn().mockResolvedValue(codeRow()) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await expect(
      service.exchangeToken({
        grant_type: 'authorization_code',
        code: rawCode,
        code_verifier: 'wrong',
        redirect_uri: 'http://127.0.0.1:10000/cb',
        client_id: 'client-1',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'invalid_grant' }) });
  });

  it('issues hashed access and refresh tokens for a valid code', async () => {
    const prisma = {
      oauthAuthorizationCode: {
        findUnique: jest.fn().mockResolvedValue(codeRow()),
        update: jest.fn().mockResolvedValue({}),
      },
      oauthAccessToken: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { tokenHash: string } }) => ({
          id: 'at-1',
          tokenHash: data.tokenHash,
        })),
      },
      oauthRefreshToken: {
        create: jest.fn().mockImplementation(async ({ data }: { data: { tokenHash: string } }) => ({
          id: 'rt-1',
          tokenHash: data.tokenHash,
        })),
      },
      mcpConnection: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    const tokens = await service.exchangeToken({
      grant_type: 'authorization_code',
      code: rawCode,
      code_verifier: verifier,
      redirect_uri: 'http://127.0.0.1:10000/cb',
      client_id: 'client-1',
    });
    expect(tokens.access_token.startsWith('mca_')).toBe(true);
    expect(tokens.refresh_token.startsWith('mcr_')).toBe(true);
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.expires_in).toBe(900);
    const storedAccess = prisma.oauthAccessToken.create.mock.calls[0][0].data as {
      tokenHash: string;
      resource: string;
    };
    expect(storedAccess.tokenHash).toBe(hashOpaque(tokens.access_token));
    expect(storedAccess.tokenHash).not.toBe(tokens.access_token);
    expect(storedAccess.resource).toBe(MCP);
  });

  it('rejects a reused authorization code', async () => {
    const prisma = {
      oauthAuthorizationCode: {
        findUnique: jest.fn().mockResolvedValue(codeRow({ usedAt: new Date() })),
      },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await expect(
      service.exchangeToken({
        grant_type: 'authorization_code',
        code: rawCode,
        code_verifier: verifier,
        redirect_uri: 'http://127.0.0.1:10000/cb',
        client_id: 'client-1',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'invalid_grant' }) });
  });
});

describe('OauthService.refresh and revoke', () => {
  it('kills the token family when a rotated refresh token is reused', async () => {
    const prisma = {
      oauthRefreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rt-old',
          tokenHash: hashOpaque('mcr_old'),
          connectionId: 'conn-1',
          organizationId: 'org-1',
          expiresAt: new Date(Date.now() + 86_400_000),
          revokedAt: new Date(),
          replacedById: 'rt-new',
          accessTokenId: 'at-old',
          connection: { revokedAt: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      oauthAccessToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      mcpConnection: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await expect(
      service.exchangeToken({ grant_type: 'refresh_token', refresh_token: 'mcr_old' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'invalid_grant' }) });
    expect(prisma.oauthRefreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.oauthAccessToken.updateMany).toHaveBeenCalled();
  });

  it('revokes a McpConnection and its tokens', async () => {
    const prisma = {
      mcpConnection: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conn-1', organizationId: 'org-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      oauthAccessToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      oauthRefreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new OauthService(prisma as never, makeConfig() as never);
    await service.revokeConnection('org-1', 'user-1', 'conn-1');
    expect(prisma.mcpConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'integration.mcp_connection.revoked' }),
      }),
    );
  });
});

