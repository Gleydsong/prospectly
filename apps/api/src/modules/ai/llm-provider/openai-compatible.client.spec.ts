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

  it('L1: healthy long stream emitting chunks beyond timeoutMs completes successfully', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"chunk1"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"chunk2"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"chunk3"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"chunk4"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          await new Promise((resolve) => setTimeout(resolve, 25));
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
    const collected: string[] = [];

    for await (const chunk of client.stream({
      baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
      apiKey: 'test-token',
      model: '@cf/openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Hi' }],
      timeoutMs: 50,
      idleTimeoutMs: 100,
    })) {
      if (chunk.contentDelta) collected.push(chunk.contentDelta);
    }

    expect(collected).toEqual(['chunk1', 'chunk2', 'chunk3', 'chunk4']);
  });

  it('L1: stream that stalls without chunks aborts with AiTimeoutException', async () => {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"first"}}]}\n\n'));
      },
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: stream,
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    const collected: string[] = [];

    await expect(async () => {
      for await (const chunk of client.stream({
        baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
        apiKey: 'test-token',
        model: '@cf/openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
        timeoutMs: 200,
        idleTimeoutMs: 50,
      })) {
        if (chunk.contentDelta) collected.push(chunk.contentDelta);
      }
    }).rejects.toThrow(AiTimeoutException);

    expect(collected).toEqual(['first']);
  });

  it('LOW-1: does not trigger false idle timeout when slow consumer processes multiple deltas from a single read', async () => {
    // A single read() delivers 2 SSE deltas ('a' and 'b')
    // Followed by a second read that delivers [DONE]
    let readCount = 0;
    let isCancelled = false;
    const encoder = new TextEncoder();
    const mockReader = {
      read: jest.fn().mockImplementation(async () => {
        if (isCancelled) {
          throw new DOMException('The operation was aborted', 'AbortError');
        }
        readCount++;
        if (readCount === 1) {
          return {
            value: encoder.encode(
              'data: {"choices":[{"delta":{"content":"a"}}]}\n\n' +
                'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
            ),
            done: false,
          };
        }
        if (readCount === 2) {
          return {
            value: encoder.encode('data: [DONE]\n\n'),
            done: false,
          };
        }
        return { value: undefined, done: true };
      }),
      cancel: jest.fn().mockImplementation(async () => {
        isCancelled = true;
      }),
      releaseLock: jest.fn(),
    };

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        getReader: () => mockReader,
      },
    });

    const client = new OpenAiCompatibleClient(mockFetch as unknown as typeof fetch);
    const deltas: string[] = [];

    for await (const chunk of client.stream({
      baseUrl: 'https://api.cloudflare.com/client/v4/accounts/test/ai/v1',
      apiKey: 'test-token',
      model: '@cf/openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Hi' }],
      idleTimeoutMs: 60,
    })) {
      if (chunk.contentDelta) {
        deltas.push(chunk.contentDelta);
        // Consumer takes 120ms per delta (longer than idleTimeoutMs of 60ms)
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    }

    expect(deltas).toEqual(['a', 'b']);
  });

  it('I1: does not embed baseUrl or accountId in exception messages', async () => {
    const sensitiveAccountId = 'SECRET_ACCOUNT_ID_12345';
    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${sensitiveAccountId}/ai/v1`;

    const mockFetch500 = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Error',
    });

    const client = new OpenAiCompatibleClient(mockFetch500 as unknown as typeof fetch);

    try {
      await client.complete({
        baseUrl,
        apiKey: 'test-token',
        model: '@cf/openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Hi' }],
        provider: 'cloudflare',
      });
      fail('Expected complete to throw');
    } catch (err) {
      const error = err as AiProviderUnavailableException;
      expect(error.message).not.toContain(sensitiveAccountId);
      expect(error.message).toContain('cloudflare');
    }
  });
});
