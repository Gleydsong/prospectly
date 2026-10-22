import { Injectable, Logger, Optional } from '@nestjs/common';

import {
  AiProviderUnavailableException,
  AiRateLimitException,
  AiRequestAbortedException,
  AiTimeoutException,
  LlmMessage,
  LlmStreamChunk,
  LlmTool,
  LlmToolCall,
  LlmUsage,
} from './llm-provider.types';

export interface OpenAiClientRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: Record<string, unknown>;
  };
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  provider?: string;
  signal?: AbortSignal;
}

function resolveProviderLabel(req: OpenAiClientRequest): string {
  if (req.provider) return req.provider;
  if (req.baseUrl.includes('cloudflare.com')) return 'cloudflare';
  if (req.baseUrl.includes('groq.com')) return 'groq';
  return 'ai-provider';
}

export interface OpenAiRawResponse {
  content: string | null;
  toolCalls?: LlmToolCall[];
  usage: LlmUsage;
  rawJson?: unknown;
}

@Injectable()
export class OpenAiCompatibleClient {
  private readonly logger = new Logger(OpenAiCompatibleClient.name);
  private fetchFn: typeof fetch = globalThis.fetch.bind(globalThis);

  constructor(@Optional() fetchFn?: typeof fetch) {
    if (fetchFn) {
      this.fetchFn = fetchFn;
    }
  }

  setFetchFn(fn: typeof fetch): void {
    this.fetchFn = fn;
  }

  async complete(req: OpenAiClientRequest, customFetch?: typeof fetch): Promise<OpenAiRawResponse> {
    const fetchImpl = customFetch ?? this.fetchFn;
    const url = `${req.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const timeoutMs = req.timeoutMs ?? 30_000;
    const providerLabel = resolveProviderLabel(req);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const onExternalAbort = () => controller.abort();
    if (req.signal) {
      if (req.signal.aborted) {
        controller.abort();
      } else {
        req.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: false,
    };

    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.responseFormat !== undefined) body.response_format = req.responseFormat;
    if (req.tools && req.tools.length > 0) body.tools = req.tools;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (req.apiKey) {
      headers.Authorization = `Bearer ${req.apiKey}`;
    }

    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new AiRateLimitException(`HTTP 429 Too Many Requests from ${providerLabel}`);
        }
        throw new AiProviderUnavailableException(
          `HTTP ${response.status} from ${providerLabel}`,
          providerLabel,
        );
      }

      let payload: {
        choices?: Array<{
          message?: {
            content?: string;
            tool_calls?: LlmToolCall[];
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      try {
        payload = (await response.json()) as typeof payload;
      } catch {
        throw new AiProviderUnavailableException(
          `Invalid JSON response from ${providerLabel}`,
          providerLabel,
          new Error('Malformed JSON payload'),
        );
      }

      const choice = payload.choices?.[0]?.message;
      const content = choice?.content ?? null;
      const toolCalls = choice?.tool_calls;
      const usage: LlmUsage = {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0,
      };

      return {
        content,
        toolCalls,
        usage,
        rawJson: payload,
      };
    } catch (error) {
      if (req.signal?.aborted) {
        throw new AiRequestAbortedException();
      }
      if (controller.signal.aborted) {
        throw new AiTimeoutException(
          `Request to ${providerLabel} timed out after ${timeoutMs}ms`,
          timeoutMs,
        );
      }
      if (
        error instanceof AiRateLimitException ||
        error instanceof AiProviderUnavailableException
      ) {
        throw error;
      }
      throw new AiProviderUnavailableException(
        `Failed to reach ${providerLabel}: network or transport error`,
        providerLabel,
        error instanceof Error ? new Error(error.name) : undefined,
      );
    } finally {
      clearTimeout(timer);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
    }
  }

  async *stream(
    req: OpenAiClientRequest,
    customFetch?: typeof fetch,
  ): AsyncIterable<LlmStreamChunk> {
    const fetchImpl = customFetch ?? this.fetchFn;
    const url = `${req.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const connectTimeoutMs = req.timeoutMs ?? 30_000;
    const idleTimeoutMs = req.idleTimeoutMs ?? req.timeoutMs ?? 30_000;
    const providerLabel = resolveProviderLabel(req);

    const controller = new AbortController();
    let timeoutReason: 'connect' | 'idle' | null = null;

    let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      timeoutReason = 'connect';
      controller.abort();
    }, connectTimeoutMs);

    const onExternalAbort = () => controller.abort();
    if (req.signal) {
      if (req.signal.aborted) {
        controller.abort();
      } else {
        req.signal.addEventListener('abort', onExternalAbort, { once: true });
      }
    }

    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages,
      stream: true,
    };

    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    if (req.responseFormat !== undefined) body.response_format = req.responseFormat;
    if (req.tools && req.tools.length > 0) body.tools = req.tools;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (req.apiKey) {
      headers.Authorization = `Bearer ${req.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (connectTimer) clearTimeout(connectTimer);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      if (req.signal?.aborted) {
        throw new AiRequestAbortedException();
      }
      if (controller.signal.aborted) {
        throw new AiTimeoutException(
          `Stream request to ${providerLabel} timed out`,
          connectTimeoutMs,
        );
      }
      throw new AiProviderUnavailableException(
        `Failed to start stream with ${providerLabel}: ${error instanceof Error ? error.name : 'UnknownError'}`,
        providerLabel,
        error instanceof Error ? new Error(error.name) : undefined,
      );
    }

    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }

    if (!response.ok) {
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      if (response.status === 429) {
        throw new AiRateLimitException(`HTTP 429 from ${providerLabel}`);
      }
      throw new AiProviderUnavailableException(
        `HTTP ${response.status} from ${providerLabel}`,
        providerLabel,
      );
    }

    if (!response.body) {
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      throw new AiProviderUnavailableException('Empty response body in stream', providerLabel);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        timeoutReason = 'idle';
        controller.abort();
        try {
          reader.cancel().catch(() => {});
        } catch {
          // ignore
        }
      }, idleTimeoutMs);
    };

    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };

    const onControllerAbort = () => {
      try {
        reader.cancel().catch(() => {});
      } catch {
        // ignore
      }
    };
    controller.signal.addEventListener('abort', onControllerAbort, { once: true });

    try {
      while (true) {
        resetIdleTimer();
        const { value, done } = await reader.read();
        if (done) break;
        resetIdleTimer();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // keep-alive or comment
          if (trimmed === 'data: [DONE]') {
            clearIdleTimer();
            yield { isDone: true };
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                    tool_calls?: Array<{
                      index: number;
                      id?: string;
                      function?: { name?: string; arguments?: string };
                    }>;
                  };
                  finish_reason?: string;
                }>;
                usage?: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                };
              };

              const delta = parsed.choices?.[0]?.delta;
              const isFinish = parsed.choices?.[0]?.finish_reason != null;
              const usage = parsed.usage
                ? {
                    promptTokens: parsed.usage.prompt_tokens ?? 0,
                    completionTokens: parsed.usage.completion_tokens ?? 0,
                    totalTokens: parsed.usage.total_tokens ?? 0,
                  }
                : undefined;

              yield {
                contentDelta: delta?.content,
                toolCallsDelta: delta?.tool_calls,
                isDone: isFinish,
                usage,
              };
            } catch {
              // Non-JSON line in SSE stream, ignore or continue
            }
          }
        }
      }

      clearIdleTimer();

      if (req.signal?.aborted) {
        throw new AiRequestAbortedException();
      }
      if (controller.signal.aborted && timeoutReason) {
        throw new AiTimeoutException(
          `Stream request to ${providerLabel} timed out`,
          timeoutReason === 'idle' ? idleTimeoutMs : connectTimeoutMs,
        );
      }

      yield { isDone: true };
    } catch (error) {
      clearIdleTimer();
      if (req.signal?.aborted) {
        throw new AiRequestAbortedException();
      }
      if (controller.signal.aborted) {
        throw new AiTimeoutException(
          `Stream request to ${providerLabel} timed out`,
          timeoutReason === 'idle' ? idleTimeoutMs : connectTimeoutMs,
        );
      }
      if (
        error instanceof AiRateLimitException ||
        error instanceof AiProviderUnavailableException ||
        error instanceof AiTimeoutException ||
        error instanceof AiRequestAbortedException
      ) {
        throw error;
      }
      throw new AiProviderUnavailableException(
        'Failed to read provider stream',
        providerLabel,
        error instanceof Error ? new Error(error.name) : undefined,
      );
    } finally {
      if (connectTimer) clearTimeout(connectTimer);
      clearIdleTimer();
      controller.signal.removeEventListener('abort', onControllerAbort);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
  }
}
