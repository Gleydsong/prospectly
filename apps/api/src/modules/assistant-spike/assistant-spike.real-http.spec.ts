import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import type { Role } from '@prisma/client';
import type { AddressInfo } from 'node:net';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AssistantSpikeController } from './assistant-spike.controller';
import { AssistantSpikeGuard } from './assistant-spike.guard';
import { AssistantSpikeService } from './assistant-spike.service';

class MockJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    req.user = {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'owner@prospectly.test',
      role: 'OWNER' as Role,
    };
    return true;
  }
}

describe('Assistant Spike Real HTTP Abort & Streaming (TDD)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let upstreamSignal: AbortSignal | undefined;
  let upstreamAborted = false;

  const mockService = {
    streamConversation: jest.fn(),
    resumeDecision: jest.fn(),
  };

  const mockConfigService = {
    get: (key: string) => {
      if (key === 'ASSISTANT_SPIKE_ENABLED') return 'true';
      if (key === 'assistantSpike.enabled') return true;
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalGuards(new MockJwtAuthGuard());

    // Bind to real ephemeral port
    await app.listen(0);
    const server = app.getHttpServer();
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}/api/v1/assistant/spike`;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    upstreamSignal = undefined;
    upstreamAborted = false;
  });

  it('(a) cliente lê todos os deltas e o upstream NÃO recebe abort', async () => {
    mockService.streamConversation.mockImplementation(async function* (params: {
      signal?: AbortSignal;
    }) {
      upstreamSignal = params.signal;
      params.signal?.addEventListener('abort', () => {
        upstreamAborted = true;
      });

      for (let i = 1; i <= 3; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (params.signal?.aborted) {
          upstreamAborted = true;
          return;
        }
        yield { type: 'chunk', data: { text: `Delta ${i} ` } };
      }
      yield { type: 'done', data: { status: 'completed' } };
    });

    const response = await fetch(`${baseUrl}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Olá' }],
      }),
    });

    expect(response.status).toBe(200);

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let fullText = '';
    let reading1 = true;
    while (reading1) {
      const { done, value } = await reader!.read();
      if (done) {
        reading1 = false;
        break;
      }
      fullText += decoder.decode(value, { stream: true });
    }

    expect(fullText).toContain('Delta 1');
    expect(fullText).toContain('Delta 2');
    expect(fullText).toContain('Delta 3');
    expect(upstreamAborted).toBe(false);
    expect(upstreamSignal?.aborted).toBe(false);
  });

  it('(b) cliente aborta o fetch após o 1º delta e o signal do upstream fica aborted em <500 ms', async () => {
    mockService.streamConversation.mockImplementation(async function* (params: {
      signal?: AbortSignal;
    }) {
      upstreamSignal = params.signal;
      params.signal?.addEventListener('abort', () => {
        upstreamAborted = true;
      });

      for (let i = 1; i <= 5; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (params.signal?.aborted) {
          upstreamAborted = true;
          return;
        }
        yield { type: 'chunk', data: { text: `Delta ${i} ` } };
      }
      yield { type: 'done', data: { status: 'completed' } };
    });

    const clientAbortController = new AbortController();

    const response = await fetch(`${baseUrl}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Olá' }],
      }),
      signal: clientAbortController.signal,
    });

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let receivedFirstDelta = false;

    let reading2 = true;
    try {
      while (reading2) {
        const { done, value } = await reader!.read();
        if (done) {
          reading2 = false;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        if (chunk.includes('Delta 1')) {
          receivedFirstDelta = true;
          // Client aborts after 1st delta
          clientAbortController.abort();
          reading2 = false;
          break;
        }
      }
    } catch {
      // Fetch aborted expected
    }

    expect(receivedFirstDelta).toBe(true);

    // Wait up to 500ms for upstream signal to reflect abort
    const startWait = Date.now();
    while (!upstreamAborted && Date.now() - startWait < 500) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(upstreamAborted).toBe(true);
    expect(upstreamSignal?.aborted).toBe(true);
  });
});
