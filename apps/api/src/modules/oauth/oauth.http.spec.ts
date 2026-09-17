import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { initHttpIntegrationApp } from '../../common/testing/http-integration';
import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE } from '../../config/http-surface';
import { OauthController } from './oauth.controller';
import { OauthService } from './oauth.service';

const cursorDcrBody = {
  redirect_uris: [
    'cursor://anysphere.cursor-mcp/oauth/callback',
    'https://www.cursor.com/agents/mcp/oauth/callback',
    'http://localhost:8787/callback',
  ],
  token_endpoint_auth_method: 'none',
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  client_name: 'Cursor',
  logo_uri: 'https://example.com/cursor.svg',
  scope: 'prospectly.plugin.read',
};

describe('OAuth DCR HTTP surface', () => {
  let app: INestApplication;
  const registerClient = jest.fn();

  beforeEach(async () => {
    registerClient.mockReset();
    const module = await Test.createTestingModule({
      controllers: [OauthController],
      providers: [
        {
          provide: OauthService,
          useValue: {
            registerClient,
            buildConsentRedirectUrl: jest.fn(),
            consent: jest.fn(),
            exchangeToken: jest.fn(),
            revokeToken: jest.fn(),
          },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX, { exclude: API_GLOBAL_PREFIX_EXCLUDE });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
      }),
    );
    await initHttpIntegrationApp(app);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('accepts Cursor DCR metadata that RFC 7591 clients send beyond redirect_uris', async () => {
    registerClient.mockResolvedValue({
      client_id: 'client-1',
      client_name: 'Cursor',
      redirect_uris: cursorDcrBody.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/oauth/register')
      .send(cursorDcrBody)
      .expect(201);

    expect(res.body.client_id).toBe('client-1');
    expect(registerClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_name: 'Cursor',
        redirect_uris: cursorDcrBody.redirect_uris,
        token_endpoint_auth_method: 'none',
      }),
    );
  });
});
