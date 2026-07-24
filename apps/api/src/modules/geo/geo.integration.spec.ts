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
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns regions for Brazil and Portugal', async () => {
    const br = await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'BR' }).expect(200);
    expect(br.body.some((region: { code: string }) => region.code === 'SP')).toBe(true);

    const pt = await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'pt' }).expect(200);
    expect(pt.body.some((region: { name: string }) => region.name === 'Lisbon')).toBe(true);
  });

  it('returns cities for a region and rejects invalid country/region', async () => {
    const regions = await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'PT' }).expect(200);
    const lisbon = regions.body.find((region: { name: string }) => region.name === 'Lisbon');
    expect(lisbon).toBeDefined();

    const cities = await request(app.getHttpServer())
      .get('/api/v1/geo/cities')
      .query({ country: 'PT', region: lisbon.code })
      .expect(200);
    expect(cities.body.length).toBeGreaterThan(0);

    await request(app.getHttpServer()).get('/api/v1/geo/regions').query({ country: 'US' }).expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/geo/cities')
      .query({ country: 'BR', region: 'XX' })
      .expect(400);
  });
});
