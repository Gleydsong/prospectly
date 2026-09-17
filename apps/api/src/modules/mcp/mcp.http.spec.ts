import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { API_GLOBAL_PREFIX, API_GLOBAL_PREFIX_EXCLUDE } from '../../config/http-surface';
import { initHttpIntegrationApp } from '../../common/testing/http-integration';
import { PluginAccessService } from '../integrations/plugin-access.service';
import { OauthMetadataController } from '../oauth/oauth-metadata.controller';
import { OauthService } from '../oauth/oauth.service';
import { McpController } from './mcp.controller';

const MCP = 'http://127.0.0.1:3000/mcp';

describe('MCP HTTP surface', () => {
  let app: INestApplication;
  const resolveAccessToken = jest.fn();
  const extract = jest.fn();

  beforeEach(async () => {
    resolveAccessToken.mockReset();
    extract.mockReset();
    const module = await Test.createTestingModule({
      controllers: [McpController, OauthMetadataController],
      providers: [
        {
          provide: OauthService,
          useValue: {
            mcpResourceUrl: () => MCP,
            resolveAccessToken,
          },
        },
        {
          provide: PluginAccessService,
          useValue: { extract },
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX, { exclude: API_GLOBAL_PREFIX_EXCLUDE });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await initHttpIntegrationApp(app);
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns 401 and WWW-Authenticate when POST /mcp has no Bearer', async () => {
    const res = await request(app.getHttpServer()).post('/mcp').expect(401);
    expect(res.headers['www-authenticate']).toContain('Bearer');
    expect(res.headers['www-authenticate']).toContain(
      'resource_metadata="http://127.0.0.1:3000/.well-known/oauth-protected-resource"',
    );
    expect(res.body.error).toBe('invalid_token');
  });

  it('rejects an app JWT and a PluginToken on /mcp', async () => {
    await request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig')
      .expect(401);
    await request(app.getHttpServer())
      .post('/mcp')
      .set('Authorization', 'Bearer pst_secret')
      .expect(401);
    expect(resolveAccessToken).not.toHaveBeenCalled();
  });

  it('serves well-known metadata outside /api/v1', async () => {
    const protectedResource = await request(app.getHttpServer())
      .get('/.well-known/oauth-protected-resource')
      .expect(200);
    expect(protectedResource.body.resource).toBe(MCP);
    expect(protectedResource.body.scopes_supported).toEqual(['prospectly.plugin.read']);

    const asMeta = await request(app.getHttpServer())
      .get('/.well-known/oauth-authorization-server')
      .expect(200);
    expect(asMeta.body.code_challenge_methods_supported).toEqual(['S256']);
    expect(asMeta.body.token_endpoint).toBe('http://127.0.0.1:3000/api/v1/oauth/token');

    await request(app.getHttpServer()).post('/api/v1/mcp').expect(404);
  });
});
