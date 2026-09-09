import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { decryptRefreshToken } from './token-crypto';
import { createGoogleOAuthState } from './oauth-state';
import { GOOGLE_CONNECTION_SCOPES, GoogleConnectionsService } from './google-connections.service';

const KEY = 'aa'.repeat(32);
const JWT_SECRET = 'test-jwt-access-secret-min-32-chars!!';
const REDIRECT = 'http://localhost:3000/api/v1/google-connections/callback';

const makeConfig = (overrides: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    'google.clientId': 'cid.apps.googleusercontent.com',
    'google.clientSecret': 'g-secret',
    'google.oauthRedirectUri': REDIRECT,
    'google.tokenEncryptionKey': KEY,
    'jwt.accessSecret': JWT_SECRET,
    frontendUrl: 'http://localhost:5173',
    ...overrides,
  };
  return { get: (key: string) => values[key] };
};

const connectedRow = {
  id: 'conn-1',
  organizationId: 'org-1',
  userId: 'u1',
  googleSubject: 'sub-1',
  googleEmail: 'ana@gmail.com',
  refreshTokenEncrypted: 'iv:tag:cipher',
  scopes: GOOGLE_CONNECTION_SCOPES.join(' '),
  connectedAt: new Date('2026-09-07T12:00:00.000Z'),
  revokedAt: null,
  lastSyncAt: null,
  lastError: null,
};

const makePrisma = () => {
  const prisma = {
    googleConnection: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };
  return prisma;
};

const makeGoogle = () => ({
  exchangeAuthorizationCode: jest.fn().mockResolvedValue({
    refreshToken: 'refresh-token-plain',
    accessToken: 'access-token',
    googleEmail: 'ana@gmail.com',
    googleSubject: 'sub-1',
    scope: GOOGLE_CONNECTION_SCOPES.join(' '),
  }),
});

describe('GoogleConnectionsService', () => {
  it('returns disconnected when the user has no Conexão Google', async () => {
    const prisma = makePrisma();
    prisma.googleConnection.findUnique.mockResolvedValue(null);
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      { log: jest.fn() } as never,
      makeGoogle() as never,
    );

    await expect(service.getMine('org-1', 'u1')).resolves.toEqual({
      connected: false,
      googleEmail: null,
      connectedAt: null,
      lastSyncAt: null,
      lastError: null,
    });
    expect(JSON.stringify(await service.getMine('org-1', 'u1'))).not.toContain('refresh');
  });

  it('maps a legacy Gmail list lastError to a public code without the raw Google text', async () => {
    const prisma = makePrisma();
    prisma.googleConnection.findUnique.mockResolvedValue({
      ...connectedRow,
      lastError: 'Gmail list failed',
    });
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      { log: jest.fn() } as never,
      makeGoogle() as never,
    );

    await expect(service.getMine('org-1', 'u1')).resolves.toEqual({
      connected: true,
      googleEmail: 'ana@gmail.com',
      connectedAt: '2026-09-07T12:00:00.000Z',
      lastSyncAt: null,
      lastError: 'gmail_list_failed',
    });
  });

  it('builds an offline auth URL without send scopes', () => {
    const service = new GoogleConnectionsService(
      makePrisma() as never,
      makeConfig() as never,
      { log: jest.fn() } as never,
      makeGoogle() as never,
    );
    const url = service.buildAuthorizationUrl('u1', 'org-1');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    expect(url).toContain(encodeURIComponent('gmail.readonly'));
    expect(url).toContain(encodeURIComponent('calendar.readonly'));
    expect(url).not.toContain('gmail.send');
    expect(url).toContain('state=');
  });

  it('refuses to start when Google OAuth is not configured', () => {
    const service = new GoogleConnectionsService(
      makePrisma() as never,
      makeConfig({ 'google.clientId': '' }) as never,
      { log: jest.fn() } as never,
      makeGoogle() as never,
    );
    expect(() => service.buildAuthorizationUrl('u1', 'org-1')).toThrow(ServiceUnavailableException);
  });

  it('stores an encrypted refresh token and never returns it', async () => {
    const prisma = makePrisma();
    const google = makeGoogle();
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    prisma.googleConnection.upsert.mockImplementation(async ({ create }: { create: typeof connectedRow }) => ({
      ...connectedRow,
      refreshTokenEncrypted: create.refreshTokenEncrypted,
    }));
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      audit as never,
      google as never,
    );
    const state = createGoogleOAuthState({ userId: 'u1', organizationId: 'org-1' }, JWT_SECRET);

    const view = await service.completeFromCallback('auth-code', state);

    expect(view.connected).toBe(true);
    expect(view.googleEmail).toBe('ana@gmail.com');
    expect(view).not.toHaveProperty('refreshTokenEncrypted');
    const stored = prisma.googleConnection.upsert.mock.calls[0][0].create.refreshTokenEncrypted as string;
    expect(stored).not.toBe('refresh-token-plain');
    expect(stored).not.toContain('refresh-token-plain');
    expect(decryptRefreshToken(stored, KEY)).toBe('refresh-token-plain');
    expect(JSON.stringify(audit.log.mock.calls[0][0])).not.toContain('refresh-token-plain');
    expect(google.exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: 'auth-code',
      redirectUri: REDIRECT,
    });
  });

  it('enqueues a Gmail sync with connection id only after connect', async () => {
    const prisma = makePrisma();
    const google = makeGoogle();
    const gmailIngest = { enqueueConnection: jest.fn().mockResolvedValue(undefined) };
    prisma.googleConnection.upsert.mockResolvedValue(connectedRow);
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      google as never,
      gmailIngest as never,
    );
    const state = createGoogleOAuthState({ userId: 'u1', organizationId: 'org-1' }, JWT_SECRET);
    await service.completeFromCallback('auth-code', state);
    await new Promise((resolve) => setImmediate(resolve));
    expect(gmailIngest.enqueueConnection).toHaveBeenCalledWith('org-1', 'conn-1');
    expect(JSON.stringify(gmailIngest.enqueueConnection.mock.calls)).not.toContain('snippet');
  });

  it('rejects a bad OAuth state', async () => {
    const service = new GoogleConnectionsService(
      makePrisma() as never,
      makeConfig() as never,
      { log: jest.fn() } as never,
      makeGoogle() as never,
    );
    await expect(service.completeFromCallback('code', 'nope')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('disconnects without deleting the row and keeps history possible', async () => {
    const prisma = makePrisma();
    prisma.googleConnection.findUnique.mockResolvedValue(connectedRow);
    prisma.googleConnection.update.mockResolvedValue({ ...connectedRow, refreshTokenEncrypted: null });
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      makeGoogle() as never,
    );

    const view = await service.disconnect('org-1', 'u1');
    expect(view.connected).toBe(false);
    expect(prisma.googleConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refreshTokenEncrypted: null, revokedAt: expect.any(Date) }),
      }),
    );
    expect(prisma.googleConnection.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ id: undefined }) }),
    );
  });

  it('lets an admin revoke another member and 404s when missing', async () => {
    const prisma = makePrisma();
    prisma.googleConnection.findUnique
      .mockResolvedValueOnce({ ...connectedRow, userId: 'u2' })
      .mockResolvedValueOnce(null);
    prisma.googleConnection.update.mockResolvedValue({});
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      makeGoogle() as never,
    );

    await service.revoke('org-1', 'admin-1', 'u2');
    expect(prisma.googleConnection.update).toHaveBeenCalled();
    await expect(service.revoke('org-1', 'admin-1', 'u-missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('exports connection metadata without tokens', async () => {
    const prisma = makePrisma();
    prisma.googleConnection.findMany.mockResolvedValue([
      {
        organizationId: 'org-1',
        googleEmail: 'ana@gmail.com',
        connectedAt: new Date('2026-09-07T12:00:00.000Z'),
        revokedAt: null,
      },
    ]);
    const service = new GoogleConnectionsService(
      prisma as never,
      makeConfig() as never,
      { log: jest.fn() } as never,
      makeGoogle() as never,
    );

    const exported = await service.exportForUser('u1');
    expect(exported).toEqual([
      {
        organizationId: 'org-1',
        googleEmail: 'ana@gmail.com',
        connectedAt: '2026-09-07T12:00:00.000Z',
        revokedAt: null,
      },
    ]);
    expect(JSON.stringify(exported)).not.toContain('refresh');
    expect(JSON.stringify(exported)).not.toContain('Encrypted');
  });
});
