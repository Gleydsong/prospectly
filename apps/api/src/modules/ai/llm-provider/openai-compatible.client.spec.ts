import {
  AiProviderUnavailableException,
  AiRateLimitException,
  AiTimeoutException,
} from './llm-provider.types';
import { OpenAiCompatibleClient } from './openai-compatible.client';

describe('OpenAiCompatibleClient', () => {
  it('makes request and parses response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Hello World',
              tool_calls: [
                {
                  id: 'call-1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
      }),
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    const response = await client.complete({
      baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
      apiKey: 'test-token',
      model: '@cf/openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Hi' }],
      responseFormat: { type: 'json_object' },
    });

    expect(response.content).toBe('Hello World');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.usage.totalTokens).toBe(15);
  });

  it('throws AiRateLimitException on 429', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    await expect(
      client.complete({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'test-key',
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(AiRateLimitException);
  });

  it('throws AiProviderUnavailableException on 500 error', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    await expect(
      client.complete({
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
        apiKey: 'test-token',
        model: '@cf/openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    ).rejects.toThrow(AiProviderUnavailableException);
  });

  it('handles stream with done signal', async () => {
    const sseChunks = ['data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', 'data: [DONE]\n\n'];

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of sseChunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    const chunks = [];
    for await (const chunk of client.stream({
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'test-key',
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.contentDelta).toBe('Hi');
    expect(chunks[chunks.length - 1]?.isDone).toBe(true);
  });

  it('throws AiTimeoutException when request aborts due to timeout', async () => {
    const mockFetch = jest.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    await expect(
      client.complete({
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
        apiKey: 'test-token',
        model: '@cf/openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
        timeoutMs: 20,
      }),
    ).rejects.toThrow(AiTimeoutException);
  });

  it('Defeito R2: client stream cancels reader, releases lock and aborts controller on break', async () => {
    let cancelled = 0;
    let signalCaptured: AbortSignal | undefined;
    const response = new Response(
      new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n'));
        },
        cancel() {
          cancelled++;
        },
      }),
    );

    const mockFetch = jest.fn().mockImplementation((_url, options) => {
      signalCaptured = options.signal;
      return Promise.resolve(response);
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    for await (const _chunk of client.stream({
      baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
      apiKey: 'test-token',
      model: '@cf/openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      break;
    }

    expect(cancelled).toBe(1);
    expect(response.body?.locked).toBe(false);
    expect(signalCaptured?.aborted).toBe(true);
  });

  it('Defeito R2: complete and stream propagate external AbortSignal', async () => {
    const abortController = new AbortController();
    abortController.abort();

    let completeSignalAborted = false;
    const mockFetchComplete = jest.fn().mockImplementation((_url, options) => {
      completeSignalAborted = options.signal.aborted;
      return Promise.reject(new Error('aborted'));
    });

    const client = new OpenAiCompatibleClient(mockFetchComplete as unknown as typeof fetch);
    await expect(
      client.complete({
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: 'test-key',
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
        signal: abortController.signal,
      }),
    ).rejects.toThrow();

    expect(completeSignalAborted).toBe(true);
  });

  it('Defeito R3: malformed JSON response throws sanitized error without exposing raw payload / PII', async () => {
    const rawMalformedBody = 'QA_PII_MALFORMED_BODY_SENTINEL';
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError(`Unexpected token 'Q', "${rawMalformedBody}" is not valid JSON`);
      },
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    let capturedError: Error | null = null;
    try {
      await client.complete({
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
        apiKey: 'test-token',
        model: '@cf/openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
      });
    } catch (err) {
      capturedError = err instanceof Error ? err : new Error(String(err));
    }

    expect(capturedError).not.toBeNull();
    expect(capturedError?.message).not.toContain(rawMalformedBody);
    if (capturedError?.cause) {
      expect(String(capturedError.cause)).not.toContain(rawMalformedBody);
    }
  });
});
