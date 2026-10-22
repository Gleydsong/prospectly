import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '@/stores/auth.store';
import { useAssistantSpike } from './useAssistantSpike';

describe('useAssistantSpike', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'test-jwt-token-123',
    });
  });

  function createMockSseResponse(chunks: string[]) {
    const encoder = new TextEncoder();
    let index = 0;

    const stream = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(encoder.encode(chunks[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  it('sends JWT in Authorization header, never in query string, and reads SSE text chunks', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: chunk\ndata: {"text":"Olá "}\n\n',
        'event: chunk\ndata: {"text":"cliente!"}\n\n',
        'event: done\ndata: {"status":"completed"}\n\n',
      ]),
    );
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAssistantSpike());

    await act(async () => {
      await result.current.sendMessage('Quantos clientes temos?');
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];

    // JWT must NEVER be in URL query string
    expect(url).not.toContain('token=');
    expect(url).not.toContain('jwt=');

    // JWT MUST be in Authorization header
    expect((options.headers as Record<string, string>)?.Authorization).toBe(
      'Bearer test-jwt-token-123',
    );

    // Messages updated with accumulated text
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]?.role).toBe('user');
    expect(result.current.messages[0]?.content).toBe('Quantos clientes temos?');
    expect(result.current.messages[1]?.role).toBe('assistant');
    expect(result.current.messages[1]?.content).toBe('Olá cliente!');
    expect(result.current.status).toBe('idle');
  });

  it('captures approval_required event and updates pendingIntent', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: chunk\ndata: {"text":"Ação sugerida"}\n\n',
        'event: approval_required\ndata: {"intentId":"intent-999","customerName":"Padaria Silva","action":"schedule_followup","summary":"Agendar follow-up","message":"Confirme o agendamento"}\n\n',
        'event: done\ndata: {"status":"awaiting_approval"}\n\n',
      ]),
    );
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAssistantSpike());

    await act(async () => {
      await result.current.sendMessage('Agendar follow-up');
    });

    expect(result.current.status).toBe('awaiting_approval');
    expect(result.current.pendingIntent).toEqual({
      intentId: 'intent-999',
      customerId: '',
      customerName: 'Padaria Silva',
      action: 'schedule_followup',
      summary: 'Agendar follow-up',
      message: 'Confirme o agendamento',
    });
  });

  it('aborts active stream when stop is called', async () => {
    let capturedSignal: AbortSignal | undefined;
    const mockFetch = vi.fn().mockImplementation((_url, init) => {
      capturedSignal = init?.signal;
      return new Promise(() => {}); // never resolves
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAssistantSpike());

    act(() => {
      void result.current.sendMessage('Mensagem longa');
    });

    expect(result.current.status).toBe('streaming');
    expect(capturedSignal?.aborted).toBe(false);

    act(() => {
      result.current.stop();
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.status).toBe('idle');
  });

  it('submits decision to resumption endpoint with Authorization header', async () => {
    // 1. Initial message triggers approval_required
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        createMockSseResponse([
          'event: approval_required\ndata: {"intentId":"intent-777","customerName":"Cliente Teste","action":"status_change","summary":"Alterar status","message":"Confirmar alteração"}\n\n',
          'event: done\ndata: {"status":"awaiting_approval"}\n\n',
        ]),
      )
      .mockResolvedValueOnce(
        createMockSseResponse([
          'event: chunk\ndata: {"text":"Ação aprovada e executada."}\n\n',
          'event: done\ndata: {"status":"approved"}\n\n',
        ]),
      );
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAssistantSpike());

    await act(async () => {
      await result.current.sendMessage('Mudar status');
    });

    expect(result.current.pendingIntent?.intentId).toBe('intent-777');

    // 2. Decide action
    await act(async () => {
      await result.current.decideAction('approve');
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [decisionUrl, decisionOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(decisionUrl).toContain('/actions/intent-777/decision');
    expect(decisionOptions.body).toBe(JSON.stringify({ decision: 'approve' }));
    expect((decisionOptions.headers as Record<string, string>)?.Authorization).toBe(
      'Bearer test-jwt-token-123',
    );
    expect(result.current.pendingIntent).toBeNull();
    expect(result.current.status).toBe('idle');
  });

  it('normalizes "lead" / "leads" into "cliente" / "clientes" on streamed text output (L5)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      createMockSseResponse([
        'event: chunk\ndata: {"text":"Encontrei 3 leads "}\n\n',
        'event: chunk\ndata: {"text":"qualificados. Cada lead foi contatado."}\n\n',
        'event: done\ndata: {"status":"completed"}\n\n',
      ]),
    );
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAssistantSpike());

    await act(async () => {
      await result.current.sendMessage('Verificar status');
    });

    expect(result.current.messages[1]?.content).toBe(
      'Encontrei 3 clientes qualificados. Cada cliente foi contatado.',
    );
  });
});
