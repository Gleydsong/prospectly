import { EventEmitter } from 'node:events';
import type { Response } from 'express';

import { AssistantSpikeController } from './assistant-spike.controller';
import type { AssistantSpikeService, AssistantSpikeStreamEvent } from './assistant-spike.service';

describe('AssistantSpikeController', () => {
  let controller: AssistantSpikeController;
  let mockService: {
    streamConversation: jest.Mock;
    resumeDecision: jest.Mock;
    validateDecisionIntent: jest.Mock;
  };

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    organizationId: 'org-1',
    role: 'OWNER' as const,
  };
  const orgId = 'org-1';

  beforeEach(() => {
    mockService = {
      streamConversation: jest.fn(),
      resumeDecision: jest.fn(),
      validateDecisionIntent: jest.fn(),
    };
    controller = new AssistantSpikeController(mockService as unknown as AssistantSpikeService);
  });

  function createMockHttp() {
    const resEmitter = new EventEmitter();
    const headers: Record<string, string> = {};
    const written: string[] = [];
    let ended = false;

    const res = Object.assign(resEmitter, {
      setHeader: jest.fn((k: string, v: string) => {
        headers[k] = v;
      }),
      flushHeaders: jest.fn(),
      flush: jest.fn(),
      write: jest.fn((chunk: string) => {
        written.push(chunk);
      }),
      end: jest.fn(() => {
        ended = true;
      }),
      get writableEnded() {
        return ended;
      },
    }) as unknown as Response;

    return { res, headers, written };
  }

  it('sets required SSE headers and flushes stream events', async () => {
    const { res, headers, written } = createMockHttp();

    mockService.streamConversation.mockImplementation(async function* () {
      yield { type: 'chunk', data: { text: 'Olá cliente' } };
      yield { type: 'done', data: { status: 'completed' } };
    });

    await controller.stream(res, mockUser, orgId, {
      messages: [{ role: 'user', content: 'Oi' }],
    });

    expect(headers['Content-Type']).toBe('text/event-stream');
    expect(headers['Cache-Control']).toBe('no-cache');
    expect(headers['Connection']).toBe('keep-alive');
    expect(headers['X-Accel-Buffering']).toBe('no');
    expect((res as unknown as { flushHeaders: jest.Mock }).flushHeaders).toHaveBeenCalled();

    expect(written[0]).toBe('event: chunk\ndata: {"text":"Olá cliente"}\n\n');
    expect(written[1]).toBe('event: done\ndata: {"status":"completed"}\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('aborts upstream execution when response connection closes (!res.writableEnded)', async () => {
    const { res } = createMockHttp();

    let capturedSignal: AbortSignal | undefined;
    mockService.streamConversation.mockImplementation(
      async function* (params: { signal?: AbortSignal }): AsyncGenerator<AssistantSpikeStreamEvent, void, unknown> {
        capturedSignal = params.signal;
        yield { type: 'chunk', data: { text: 'Início' } };
        // Simulate client close on response stream
        (res as unknown as EventEmitter).emit('close');
        if (params.signal?.aborted) {
          const err = new Error('Aborted');
          err.name = 'AiRequestAbortedException';
          throw err;
        }
        yield { type: 'chunk', data: { text: 'Fim' } };
      },
    );

    await controller.stream(res, mockUser, orgId, {
      messages: [{ role: 'user', content: 'Oi' }],
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it('sanitizes error messages emitted to client over SSE and does not leak internal error details', async () => {
    const { res, written } = createMockHttp();

    // eslint-disable-next-line require-yield
    mockService.streamConversation.mockImplementation(async function* () {
      const err = new Error('SELECT * FROM secret_table WHERE id = 123');
      err.name = 'DatabaseInternalCrash';
      throw err;
    });

    await controller.stream(res, mockUser, orgId, {
      messages: [{ role: 'user', content: 'Oi' }],
    });

    expect(written).toHaveLength(1);
    expect(written[0]).toContain('event: error\n');
    expect(written[0]).toContain('"code":"INTERNAL"');
    expect(written[0]).toContain('Ocorreu um erro interno');
    // Ensure raw query / internal exception is NOT leaked
    expect(written[0]).not.toContain('secret_table');
  });

  it('streams decision resumption for an action intent', async () => {
    const { res, written } = createMockHttp();

    mockService.resumeDecision.mockImplementation(async function* () {
      yield { type: 'chunk', data: { text: 'Ação aprovada com sucesso' } };
      yield { type: 'done', data: { status: 'approved' } };
    });

    await controller.decide(res, mockUser, orgId, 'intent-123', {
      decision: 'approve',
    });

    expect(written[0]).toBe('event: chunk\ndata: {"text":"Ação aprovada com sucesso"}\n\n');
    expect(written[1]).toBe('event: done\ndata: {"status":"approved"}\n\n');
    expect(res.end).toHaveBeenCalled();
  });

  it('validates intent before flushing headers and throws without opening SSE stream (M2)', async () => {
    const { res } = createMockHttp();

    mockService.validateDecisionIntent.mockImplementation(() => {
      throw new Error('Ação não pertence à organização autenticada');
    });

    await expect(
      controller.decide(res, mockUser, orgId, 'intent-other-org', {
        decision: 'approve',
      }),
    ).rejects.toThrow('Ação não pertence à organização autenticada');

    // Headers must NOT have been flushed
    expect((res as unknown as { flushHeaders: jest.Mock }).flushHeaders).not.toHaveBeenCalled();
  });
});
