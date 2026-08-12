import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';

import { RolesGuard } from '../../common/guards/roles.guard';
import { initHttpIntegrationApp } from '../../common/testing/http-integration';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      user?: { id: string; email: string; organizationId: string; role: Role };
    }>();
    request.user = {
      id: 'user-1',
      email: 'geo@prospectly.test',
      organizationId: 'org-1',
      role: String(request.headers['x-test-role'] ?? 'MEMBER') as Role,
    };
    return true;
  }
}

describe('Geo HTTP integration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [GeoController],
      providers: [GeoService],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true, exposeDefaultValues: true },
      }),
    );
    app.useGlobalGuards(new HeaderAuthGuard(), new RolesGuard(module.get(Reflector)));
    await initHttpIntegrationApp(app);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('returns Brazilian regions and rejects countries outside the product scope', async () => {
    const br = await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'BR' }).expect(200);
    expect(br.body.some((region: { code: string }) => region.code === 'SP')).toBe(true);

    await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'PT' }).expect(400);
  });

  it('returns cities for a region and rejects invalid country/region', async () => {
    const cities = await request(app.getHttpServer())
      .get('/api/v1/geo/cities')
      .query({ country: 'BR', region: 'SP' })
      .expect(200);
    expect(cities.body.length).toBeGreaterThan(0);

    await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'US' }).expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/geo/cities')
      .query({ country: 'BR', region: 'XX' })
      .expect(400);
  });
});
