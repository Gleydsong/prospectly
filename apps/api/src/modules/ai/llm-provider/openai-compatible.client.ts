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
  signal?: AbortSignal;
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
          throw new AiRateLimitException(`HTTP 429 Too Many Requests from ${req.baseUrl}`);
        }
        throw new AiProviderUnavailableException(
          `HTTP ${response.status} from ${req.baseUrl}`,
          req.baseUrl,
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
          `Invalid JSON response from ${req.baseUrl}`,
          req.baseUrl,
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
          `Request to ${req.baseUrl} timed out after ${timeoutMs}ms`,
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
        `Failed to reach ${req.baseUrl}: network or transport error`,
        req.baseUrl,
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
    const timeoutMs = req.timeoutMs ?? 30_000;

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
      clearTimeout(timer);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      if (req.signal?.aborted) {
        throw new AiRequestAbortedException();
      }
      if (controller.signal.aborted) {
        throw new AiTimeoutException(`Stream request to ${req.baseUrl} timed out`, timeoutMs);
      }
      throw new AiProviderUnavailableException(
        `Failed to start stream with ${req.baseUrl}: ${error instanceof Error ? error.name : 'UnknownError'}`,
        req.baseUrl,
        error instanceof Error ? new Error(error.name) : undefined,
      );
    }

    if (!response.ok) {
      clearTimeout(timer);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      if (response.status === 429) {
        throw new AiRateLimitException(`HTTP 429 from ${req.baseUrl}`);
      }
      throw new AiProviderUnavailableException(
        `HTTP ${response.status} from ${req.baseUrl}`,
        req.baseUrl,
      );
    }

    if (!response.body) {
      clearTimeout(timer);
      if (req.signal) {
        req.signal.removeEventListener('abort', onExternalAbort);
      }
      throw new AiProviderUnavailableException('Empty response body in stream', req.baseUrl);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // keep-alive or comment
          if (trimmed === 'data: [DONE]') {
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

      yield { isDone: true };
    } catch (error) {
      if (req.signal?.aborted) {
        throw new AiRequestAbortedException();
      }
      if (controller.signal.aborted) {
        throw new AiTimeoutException(`Stream request to ${req.baseUrl} timed out`, timeoutMs);
      }
      throw new AiProviderUnavailableException(
        'Failed to read provider stream',
        req.baseUrl,
        error instanceof Error ? new Error(error.name) : undefined,
      );
    } finally {
      clearTimeout(timer);
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
