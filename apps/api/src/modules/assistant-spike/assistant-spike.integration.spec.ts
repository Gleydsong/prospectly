import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import request from 'supertest';

import { initHttpIntegrationApp } from '../../common/testing/http-integration';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AssistantSpikeController } from './assistant-spike.controller';
import { AssistantSpikeGuard } from './assistant-spike.guard';
import { AssistantSpikeService } from './assistant-spike.service';

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    req.user = {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'owner@prospectly.test',
      role: 'OWNER' as Role,
    };
    return true;
  }
}

describe('Assistant Spike HTTP contract (Integration & TDD)', () => {
  let app: INestApplication;
  let spikeEnabled = true;

  const mockService = {
    streamConversation: jest.fn(),
    resumeDecision: jest.fn(),
  };

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'ASSISTANT_SPIKE_ENABLED') return spikeEnabled ? 'true' : 'false';
      if (key === 'assistantSpike.enabled') return spikeEnabled;
      return undefined;
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AssistantSpikeController],
      providers: [
        { provide: AssistantSpikeService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfigService },
        AssistantSpikeGuard,
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalGuards(new MockJwtAuthGuard());
    await initHttpIntegrationApp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    spikeEnabled = true;
  });

  it('1. auth sem token → 401 Unauthorized', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/assistant/spike/stream')
      .send({
        messages: [{ role: 'user', content: 'Olá' }],
      })
      .expect(401);
  });

  it('2. JWT em query rejeitado/ignorado → 401 Unauthorized', async () => {
    // Only query param token without Bearer header
    await request(app.getHttpServer())
      .post('/api/v1/assistant/spike/stream?token=malicious_in_query')
      .send({
        messages: [{ role: 'user', content: 'Olá' }],
      })
      .expect(401);

    // Even if accompanied by Bearer header, query string token is strictly rejected by AssistantSpikeGuard
    await request(app.getHttpServer())
      .post('/api/v1/assistant/spike/stream?token=leaked_in_url')
      .set('Authorization', 'Bearer valid-jwt-token')
      .send({
        messages: [{ role: 'user', content: 'Olá' }],
      })
      .expect(401);
  });

  it('3. flag desligada → 404 NotFoundException', async () => {
    spikeEnabled = false;

    await request(app.getHttpServer())
      .post('/api/v1/assistant/spike/stream')
      .set('Authorization', 'Bearer valid-jwt-token')
      .send({
        messages: [{ role: 'user', content: 'Olá' }],
      })
      .expect(404);
  });

  it('4. streaming SSE com aprovação necessária e retomada de decisão', async () => {
    mockService.streamConversation.mockImplementation(async function* () {
      yield {
        type: 'approval_required',
        data: {
          intentId: 'intent-test-456',
          customerName: 'Cliente Alpha',
          action: 'schedule_followup',
          summary: 'Agendar contato',
        },
      };
      yield {
        type: 'done',
        data: { status: 'awaiting_approval' },
      };
    });

    const streamRes = await request(app.getHttpServer())
      .post('/api/v1/assistant/spike/stream')
      .set('Authorization', 'Bearer valid-jwt-token')
      .send({
        messages: [{ role: 'user', content: 'Agende contato com Cliente Alpha' }],
        simulateTool: 'propose_customer_action',
      })
      .expect(200);

    expect(streamRes.headers['content-type']).toBe('text/event-stream');
    expect(streamRes.headers['cache-control']).toBe('no-cache');
    expect(streamRes.headers['x-accel-buffering']).toBe('no');
    expect(streamRes.text).toContain('event: approval_required');
    expect(streamRes.text).toContain('intent-test-456');

    // Retomada: decisão de aprovação
    mockService.resumeDecision.mockImplementation(async function* () {
      yield {
        type: 'chunk',
        data: { text: 'Ação confirmada e registrada com sucesso.' },
      };
      yield {
        type: 'done',
        data: { status: 'approved', intentId: 'intent-test-456' },
      };
    });

    const decisionRes = await request(app.getHttpServer())
      .post('/api/v1/assistant/spike/actions/intent-test-456/decision')
      .set('Authorization', 'Bearer valid-jwt-token')
      .send({
        decision: 'approve',
      })
      .expect(200);

    expect(decisionRes.headers['content-type']).toBe('text/event-stream');
    expect(decisionRes.text).toContain('Ação confirmada e registrada');
    expect(decisionRes.text).toContain('"status":"approved"');
  });
});
