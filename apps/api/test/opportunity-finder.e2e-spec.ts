import { CanActivate, ExecutionContext, INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Role } from '@prisma/client';
import request from 'supertest';

import { RolesGuard } from '../src/common/guards/roles.guard';
import { initHttpIntegrationApp } from '../src/common/testing/http-integration';
import { ProspectingRegionForCountry } from '../src/modules/opportunity-finder/dto/prospecting-region.validator';
import { OpportunityFinderController } from '../src/modules/opportunity-finder/opportunity-finder.controller';
import { OpportunityFinderService } from '../src/modules/opportunity-finder/opportunity-finder.service';

class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req.user = { id: 'user-1', organizationId: 'org-1', email: 'owner@prospectly.test', role: 'OWNER' as Role };
    return true;
  }
}

describe('Opportunity Finder HTTP contract', () => {
  let app: INestApplication;
  const service = {
    create: jest.fn(), get: jest.fn(), listCandidates: jest.fn(), getCandidate: jest.fn(),
    explainCandidate: jest.fn(), saveAsLead: jest.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [OpportunityFinderController],
      providers: [ProspectingRegionForCountry, { provide: OpportunityFinderService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalGuards(new TestAuthGuard(), new RolesGuard(module.get(Reflector)));
    await initHttpIntegrationApp(app);
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('accepts a valid Brazil-only run and forwards tenant identity', async () => {
    service.create.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001', status: 'PREPARING' });
    await request(app.getHttpServer()).post('/api/v1/opportunity-finder/runs').set('x-correlation-id', 'e2e-correlation').send({
      service: 'Criação de sites', niche: 'Roupas no atacado', city: 'Curitiba', state: 'pr', country: 'br',
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    }).expect(202);
    expect(service.create).toHaveBeenCalledWith('org-1', 'user-1', expect.objectContaining({
      service: 'Criação de sites', niche: 'Roupas no atacado', city: 'Curitiba', state: 'PR', country: 'BR',
    }), undefined);
  });

  it('rejects a country outside Brazil before reaching the service', async () => {
    await request(app.getHttpServer()).post('/api/v1/opportunity-finder/runs').send({
      service: 'Criação de sites', city: 'Lisboa', state: 'LX', country: 'PT',
    }).expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
});
