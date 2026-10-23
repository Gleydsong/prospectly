import { useCallback, useRef, useState } from 'react';

import { useAuthStore } from '@/stores/auth.store';
import type {
  AssistantMessage,
  AssistantStatus,
  PendingActionIntent,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

/**
 * Normalizes occurrences of "lead" / "leads" to "cliente" / "clientes",
 * aligning with Prospectly's domain terminology (L5).
 */
export function normalizeLeadToCliente(text: string): string {
  return text.replace(/\bleads?\b/gi, (word) =>
    word.toLowerCase() === 'leads' ? 'clientes' : 'cliente',
  );
}

export function useAssistantSpike() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<PendingActionIntent | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
  }, []);

  const clearMessages = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
    setPendingIntent(null);
    setStatus('idle');
  }, [stop]);

  const processSseStream = useCallback(
    async (
      response: Response,
      onChunk: (delta: string) => void,
      onEvent: (event: string, data: Record<string, unknown>) => void,
    ) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Falha ao abrir stream de resposta');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let isStreaming = true;

      while (isStreaming) {
        const { value, done } = await reader.read();
        if (done) {
          isStreaming = false;
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const lines = part.split('\n');
          let eventType = 'message';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData) as Record<string, unknown>;
              if (eventType === 'chunk' && typeof parsed.text === 'string') {
                onChunk(parsed.text);
              }
              onEvent(eventType, parsed);
            } catch {
              // Ignore malformed json frame
            }
          }
        }
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      content: string,
      options?: {
        simulateTool?: 'count_customers' | 'propose_customer_action';
        simulateCustomerName?: string;
      },
    ) => {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        setError('Usuário não autenticado');
        return;
      }

      setError(null);
      setStatus('streaming');

      const userMessage: AssistantMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      };

      const assistantMessageId = `assistant-${Date.now()}`;
      const assistantMessage: AssistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(`${API_BASE}/assistant/spike/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            simulateTool: options?.simulateTool,
            simulateCustomerName: options?.simulateCustomerName,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Assistente desativado neste ambiente (flag desligada)');
          }
          if (response.status === 401) {
            throw new Error('Sessão expirada ou não autorizada');
          }
          throw new Error(`Erro na requisição: ${response.statusText}`);
        }

        await processSseStream(
          response,
          (delta) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: normalizeLeadToCliente(msg.content + delta) }
                  : msg,
              ),
            );
          },
          (event, data) => {
            if (event === 'tool_call') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        toolCall: {
                          name: String(data.name ?? ''),
                          arguments: (data.arguments as Record<string, unknown>) ?? {},
                        },
                      }
                    : msg,
                ),
              );
            } else if (event === 'tool_result') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        toolResult: {
                          name: String(data.name ?? ''),
                          result: (data.result as Record<string, unknown>) ?? {},
                        },
                      }
                    : msg,
                ),
              );
            } else if (event === 'approval_required') {
              setPendingIntent({
                intentId: String(data.intentId ?? ''),
                customerId: String(data.customerId ?? ''),
                customerName: String(data.customerName ?? ''),
                action: String(data.action ?? ''),
                summary: String(data.summary ?? ''),
                message: String(data.message ?? ''),
              });
              setStatus('awaiting_approval');
            } else if (event === 'done') {
              if (data.status !== 'awaiting_approval') {
                setStatus('idle');
              }
            } else if (event === 'error') {
              setError(String(data.message ?? 'Erro durante o streaming'));
              setStatus('error');
            }
          },
        );
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        setError((err as Error)?.message ?? 'Erro inesperado');
        setStatus('error');
      } finally {
        abortControllerRef.current = null;
      }
    },
    [messages, processSseStream],
  );

  const decideAction = useCallback(
    async (decision: 'approve' | 'reject') => {
      if (!pendingIntent) return;

      const token = useAuthStore.getState().accessToken;
      if (!token) {
        setError('Usuário não autenticado');
        return;
      }

      setError(null);
      setStatus('streaming');

      const decisionMsgId = `decision-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: decisionMsgId,
          role: 'assistant',
          content: '',
        },
      ]);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch(
          `${API_BASE}/assistant/spike/actions/${pendingIntent.intentId}/decision`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ decision }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Sessão expirada ou não autorizada');
          }
          if (response.status === 403) {
            throw new Error('Ação não permitida para seu usuário ou perfil');
          }
          if (response.status === 404) {
            throw new Error('Ação pendente não encontrada ou já expirou');
          }
          throw new Error(`Erro ao enviar decisão: ${response.statusText}`);
        }

        await processSseStream(
          response,
          (delta) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === decisionMsgId
                  ? { ...msg, content: normalizeLeadToCliente(msg.content + delta) }
                  : msg,
              ),
            );
          },
          (event, data) => {
            if (event === 'done') {
              setStatus('idle');
              setPendingIntent(null);
            } else if (event === 'error') {
              setError(String(data.message ?? 'Erro ao processar decisão'));
              setStatus('error');
            }
          },
        );
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') {
          setStatus('idle');
          return;
        }
        setError((err as Error)?.message ?? 'Erro inesperado');
        setStatus('error');
      } finally {
        abortControllerRef.current = null;
      }
    },
    [pendingIntent, processSseStream],
  );

  return {
    messages,
    status,
    error,
    pendingIntent,
    sendMessage,
    stop,
    decideAction,
    clearMessages,
  };
}
