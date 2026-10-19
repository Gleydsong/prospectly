import { ConfigService } from '@nestjs/config';
import { AiRunStatus } from '@prisma/client';
import { z } from 'zod';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { LlmBudgetService } from './llm-budget.service';
import { LlmProviderService } from './llm-provider.service';
import { LlmTelemetryService } from './llm-telemetry.service';
import { OpenAiCompatibleClient } from './openai-compatible.client';
import {
  AiBudgetExceededException,
  AiDisabledException,
  AiInvalidStructuredOutputException,
  AiProviderUnavailableException,
  AiRateLimitException,
  AiTimeoutException,
} from './llm-provider.types';

describe('LlmProviderService', () => {
  let service: LlmProviderService;
  let budgetService: LlmBudgetService;
  let telemetryService: LlmTelemetryService;
  let client: OpenAiCompatibleClient;
  let prismaMock: {
    aiRun: {
      create: jest.Mock;
      update: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  const defaultContext = {
    organizationId: 'org-test-123',
    userId: 'user-test-456',
    task: 'TEST_TASK',
    promptVersion: 'v1.0',
  };

  const sampleSchema = z.object({
    greeting: z.string(),
    confidence: z.number().min(0).max(1),
  });

  function createService(
    configOverrides: Record<string, unknown> = {},
    customFetch?: typeof fetch,
  ): LlmProviderService {
    const configData: Record<string, unknown> = {
      'ai.provider': 'cloudflare',
      'ai.model': '@cf/openai/gpt-oss-120b',
      'ai.fallbackProvider': 'groq',
      'ai.fallbackModel': 'openai/gpt-oss-120b',
      'ai.cloudflare.accountId': 'cf-account-test',
      'ai.cloudflare.apiToken': 'cf-token-test',
      'ai.cloudflare.baseUrl':
        'https://api.cloudflare.com/client/v4/accounts/cf-account-test/ai/v1',
      'ai.groq.apiKey': 'gsk-test-key',
      'ai.groq.baseUrl': 'https://api.groq.com/openai/v1',
      'ai.timeoutMs': 1000,
      'ai.maxRetries': 1,
      'ai.dailyBudgetTokens': 50000,
      ...configOverrides,
    };

    const configService = {
      get: jest.fn((key: string) => configData[key]),
    } as unknown as ConfigService;

    prismaMock = {
      aiRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-uuid-1' }),
        update: jest.fn().mockResolvedValue({ id: 'run-uuid-1' }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { inputTokens: 1000, outputTokens: 500 },
        }),
      },
    };

    budgetService = new LlmBudgetService(configService, prismaMock as unknown as PrismaService);
    telemetryService = new LlmTelemetryService(prismaMock as unknown as PrismaService);
    client = new OpenAiCompatibleClient(customFetch ?? (jest.fn() as unknown as typeof fetch));

    return new LlmProviderService(configService, budgetService, telemetryService, client);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Sucesso (Success)', () => {
    it('executes chat completion with Cloudflare and validates structured JSON schema with Zod', async () => {
      const mockResponseBody = {
        choices: [
          {
            message: {
              content: JSON.stringify({ greeting: 'Olá, mundo!', confidence: 0.95 }),
            },
          },
        ],
        usage: {
          prompt_tokens: 42,
          completion_tokens: 18,
          total_tokens: 60,
        },
      };

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponseBody,
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      const result = await service.generateStructured(
        {
          context: defaultContext,
          schema: sampleSchema,
          system: 'Você é um assistente prestativo.',
          input: { name: 'Empresa Teste', city: 'São Paulo' },
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(result.data).toEqual({
        greeting: 'Olá, mundo!',
        confidence: 0.95,
      });
      expect(result.provider).toBe('cloudflare');
      expect(result.model).toBe('@cf/openai/gpt-oss-120b');
      expect(result.fallbackUsed).toBe(false);
      expect(result.retriesCount).toBe(0);
      expect(result.usage.totalTokens).toBe(60);

      // Verify correct endpoint was invoked
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledOptions] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe(
        'https://api.cloudflare.com/client/v4/accounts/cf-account-test/ai/v1/chat/completions',
      );
      expect(calledOptions.headers.Authorization).toBe('Bearer cf-token-test');

      // Verify telemetry completed
      expect(prismaMock.aiRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-test-123',
            userId: 'user-test-456',
            provider: 'cloudflare',
            status: AiRunStatus.PENDING,
          }),
        }),
      );
      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-uuid-1' },
          data: expect.objectContaining({
            status: AiRunStatus.COMPLETED,
            inputTokens: 42,
            outputTokens: 18,
          }),
        }),
      );
    });
  });

  describe('2. Timeout', () => {
    it('throws AiTimeoutException when request exceeds timeout and fails AiRun', async () => {
      // Mock fetch simulating abort signal timeout
      const mockFetch = jest.fn().mockImplementation((_url, options) => {
        return new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      // No fallback to isolate timeout on primary
      service = createService(
        {
          'ai.fallbackProvider': 'none',
          'ai.timeoutMs': 50,
          'ai.maxRetries': 0,
        },
        mockFetch as unknown as typeof fetch,
      );

      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Teste' }],
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiTimeoutException);

      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-uuid-1' },
          data: expect.objectContaining({
            status: AiRunStatus.FAILED,
            errorCode: 'AI_TIMEOUT',
          }),
        }),
      );
    });
  });

  describe('3. HTTP 429 Rate Limit', () => {
    it('handles HTTP 429 and throws AiRateLimitException when no fallback is configured', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      service = createService(
        {
          'ai.fallbackProvider': 'none',
          'ai.maxRetries': 0,
        },
        mockFetch as unknown as typeof fetch,
      );

      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Teste' }],
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiRateLimitException);
    });
  });

  describe('4. Troca para a reserva (Fallback to Groq)', () => {
    it('switches to Groq when Cloudflare returns 429 or 500', async () => {
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('cloudflare.com')) {
          // Cloudflare fails with 429
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => 'Cloudflare rate limit',
          });
        }
        if (url.includes('api.groq.com')) {
          // Groq succeeds
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: { content: 'Resposta do Groq' },
                },
              ],
              usage: {
                prompt_tokens: 30,
                completion_tokens: 15,
                total_tokens: 45,
              },
            }),
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      service = createService(
        {
          'ai.provider': 'cloudflare',
          'ai.fallbackProvider': 'groq',
          'ai.maxRetries': 0, // Fallback triggered after primary fails
        },
        mockFetch as unknown as typeof fetch,
      );

      const response = await service.chat(
        {
          context: defaultContext,
          messages: [{ role: 'user', content: 'Pergunta importante' }],
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(response.fallbackUsed).toBe(true);
      expect(response.provider).toBe('groq');
      expect(response.model).toBe('openai/gpt-oss-120b');
      expect(response.content).toBe('Resposta do Groq');

      // Verify Groq was called with its credentials
      const groqCall = mockFetch.mock.calls.find(([url]) => url.includes('api.groq.com'));
      expect(groqCall).toBeDefined();
      expect(groqCall[1].headers.Authorization).toBe('Bearer gsk-test-key');

      // Verify telemetry updated to completed with Groq
      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'run-uuid-1' },
          data: expect.objectContaining({
            status: AiRunStatus.COMPLETED,
            provider: 'groq',
          }),
        }),
      );
    });
  });

  describe('5. JSON Inválido (Invalid JSON & single correction retry)', () => {
    it('retries once when model returns malformed JSON and succeeds on second attempt', async () => {
      let callCount = 0;
      const mockFetch = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Attempt 1: Malformed JSON string
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: 'Não sou um JSON válido {greeting: ...' } }],
              usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
            }),
          });
        }
        // Attempt 2 (Correction retry): Valid JSON
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({ greeting: 'Corrigido!', confidence: 0.9 }),
                },
              },
            ],
            usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 },
          }),
        });
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      const result = await service.generateStructured(
        {
          context: defaultContext,
          schema: sampleSchema,
          system: 'Gere resposta JSON.',
          input: { query: 'test' },
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(callCount).toBe(2);
      expect(result.retriesCount).toBe(1);
      expect(result.data).toEqual({
        greeting: 'Corrigido!',
        confidence: 0.9,
      });
      expect(result.usage.totalTokens).toBe(85); // 30 + 55
    });

    it('throws AiInvalidStructuredOutputException when retry also fails', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Continuo não sendo JSON' } }],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      await expect(
        service.generateStructured(
          {
            context: defaultContext,
            schema: sampleSchema,
            system: 'Gere resposta JSON.',
            input: { query: 'test' },
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiInvalidStructuredOutputException);
    });
  });

  describe('6. Orçamento Esgotado (Budget Exceeded)', () => {
    it('blocks LLM calls when daily token budget for the organization is exhausted', async () => {
      const mockFetch = jest.fn();

      service = createService(
        {
          'ai.dailyBudgetTokens': 1000,
        },
        mockFetch as unknown as typeof fetch,
      );

      // Prisma aggregate returns 1200 used tokens > 1000 limit
      prismaMock.aiRun.aggregate.mockResolvedValueOnce({
        _sum: { inputTokens: 800, outputTokens: 400 },
      });

      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Pergunta' }],
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiBudgetExceededException);

      // Verify zero external HTTP calls were made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('7. Provedor Desabilitado (Disabled)', () => {
    it('throws AiDisabledException without making HTTP calls when AI_PROVIDER is disabled', async () => {
      const mockFetch = jest.fn();

      service = createService(
        {
          'ai.provider': 'disabled',
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(service.isAiEnabled()).toBe(false);

      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Pergunta' }],
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiDisabledException);

      await expect(
        service.generateStructured(
          {
            context: defaultContext,
            schema: sampleSchema,
            system: 'sys',
            input: {},
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiDisabledException);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('8. Streaming (Assistente A0 readiness)', () => {
    it('streams chat chunks correctly from an SSE stream', async () => {
      const sseChunks = [
        'data: {"choices":[{"delta":{"content":"Olá"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" mundo!"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\n',
        'data: [DONE]\n\n',
      ];

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

      service = createService({}, mockFetch as unknown as typeof fetch);

      const chunks: string[] = [];
      for await (const chunk of service.streamChat(
        {
          context: defaultContext,
          messages: [{ role: 'user', content: 'Oi' }],
        },
        mockFetch as unknown as typeof fetch,
      )) {
        if (chunk.contentDelta) chunks.push(chunk.contentDelta);
      }

      expect(chunks.join('')).toBe('Olá mundo!');
    });
  });

  describe('9. Privacidade e Sanitização (Sanitizer & Telemetry)', () => {
    it('sanitizes sensitive fields from input payload before sending to model', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ greeting: 'ok', confidence: 1 }),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      await service.generateStructured(
        {
          context: defaultContext,
          schema: sampleSchema,
          system: 'Instruções',
          input: {
            companyName: 'Padaria do Bairro',
            phone: '+5511999999999', // should be stripped by sanitizeLlmPayload
            email: 'segredo@privado.com', // should be stripped by sanitizeLlmPayload
            token: 'bearer-token-123', // should be stripped by sanitizeLlmPayload
            city: 'Campinas',
          },
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = requestBody.messages.find((m: { role: string }) => m.role === 'user');
      const parsedInput = JSON.parse(userMessage.content);

      expect(parsedInput.companyName).toBe('Padaria do Bairro');
      expect(parsedInput.city).toBe('Campinas');
      expect(parsedInput.phone).toBeUndefined();
      expect(parsedInput.email).toBeUndefined();
      expect(parsedInput.token).toBeUndefined();
    });
  });

  describe('10. Correções do QA (Issue #369 - 6 defeitos confirmados e corrigidos)', () => {
    // Defeito 1: Sanitização invariável em chat e stream
    it('Defeito 1: sanitizes JSON messages in raw chat, stripping blocked fields like email and token', async () => {
      let capturedBody: { messages: Array<{ content: string }> } | null = null;
      const mockFetch = jest.fn().mockImplementation((_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          }),
        });
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      await service.chat(
        {
          context: defaultContext,
          messages: [
            {
              role: 'user',
              content: JSON.stringify({
                email: 'qa-synthetic@example.invalid',
                token: 'synthetic-sentinel',
                prompt: 'Qual a previsão do tempo?',
              }),
            },
          ],
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.messages[0]!.content).not.toContain('synthetic-sentinel');
      expect(capturedBody!.messages[0]!.content).not.toContain('qa-synthetic@example.invalid');
      const parsed = JSON.parse(capturedBody!.messages[0]!.content);
      expect(parsed.prompt).toBe('Qual a previsão do tempo?');
      expect(parsed.email).toBeUndefined();
      expect(parsed.token).toBeUndefined();
    });

    it('Defeito 1 (stream): sanitizes JSON messages in streamChat as well', async () => {
      let capturedBody: { messages: Array<{ content: string }> } | null = null;
      const sseChunk = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n';
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sseChunk));
          controller.close();
        },
      });
      const mockFetch = jest.fn().mockImplementation((_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          body: stream,
        });
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      for await (const _chunk of service.streamChat(
        {
          context: defaultContext,
          messages: [
            {
              role: 'user',
              content: JSON.stringify({
                email: 'qa-stream@example.invalid',
                token: 'stream-token-sentinel',
                message: 'Stream message',
              }),
            },
          ],
        },
        mockFetch as unknown as typeof fetch,
      )) {
        // iterate
      }

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.messages[0]!.content).not.toContain('stream-token-sentinel');
      expect(capturedBody!.messages[0]!.content).not.toContain('qa-stream@example.invalid');
    });

    // Defeito 2: Streaming telemetria e aplicação de orçamento
    it('Defeito 2: streaming creates AiRun and enforces organizational budget, blocking subsequent stream calls when budget exceeded', async () => {
      let calls = 0;
      const makeStreamingResponse = () => {
        calls++;
        const sseContent =
          'data: {"choices":[{"delta":{"content":"ok"}}],"usage":{"prompt_tokens":70,"completion_tokens":70,"total_tokens":140}}\n\ndata: [DONE]\n\n';
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(sseContent));
            controller.close();
          },
        });
        return Promise.resolve({
          ok: true,
          status: 200,
          body: stream,
        });
      };

      const mockFetch = jest.fn().mockImplementation(makeStreamingResponse);

      // Set budget limit to 100 tokens
      service = createService(
        {
          'ai.dailyBudgetTokens': 100,
        },
        mockFetch as unknown as typeof fetch,
      );

      // Initial token usage: 0 tokens
      prismaMock.aiRun.aggregate.mockResolvedValueOnce({
        _sum: { inputTokens: 0, outputTokens: 0 },
      });

      // Stream 1: consumes 140 tokens
      for await (const _chunk of service.streamChat(
        {
          context: defaultContext,
          messages: [{ role: 'user', content: 'Stream 1' }],
        },
        mockFetch as unknown as typeof fetch,
      )) {
        // iterate
      }

      expect(calls).toBe(1);
      // Verified AiRun was created and completed
      expect(prismaMock.aiRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: defaultContext.organizationId,
            userId: defaultContext.userId,
            status: AiRunStatus.PENDING,
          }),
        }),
      );
      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AiRunStatus.COMPLETED,
            inputTokens: 70,
            outputTokens: 70,
          }),
        }),
      );

      // Now aggregate returns 140 tokens from the completed stream
      prismaMock.aiRun.aggregate.mockResolvedValueOnce({
        _sum: { inputTokens: 70, outputTokens: 70 },
      });

      // Stream 2: budget (140) exceeds limit (100) -> must reject with AiBudgetExceededException
      await expect(async () => {
        for await (const _chunk of service.streamChat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Stream 2' }],
          },
          mockFetch as unknown as typeof fetch,
        )) {
          // iterate
        }
      }).rejects.toThrow(AiBudgetExceededException);

      // Calls count should still be 1 (second call was blocked by checkBudget)
      expect(calls).toBe(1);
    });

    // Defeito 3: AI_PROVIDER=disabled não pode ser sobrescrito por req.provider
    it('Defeito 3: AI_PROVIDER=disabled rejects call and cannot be bypassed via req.provider', async () => {
      const mockFetch = jest.fn();
      service = createService(
        {
          'ai.provider': 'disabled',
        },
        mockFetch as unknown as typeof fetch,
      );

      // Attempt to bypass with req.provider: 'cloudflare'
      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'tentativa' }],
            provider: 'cloudflare',
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiDisabledException);

      await expect(async () => {
        for await (const _chunk of service.streamChat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'tentativa stream' }],
            provider: 'cloudflare',
          },
          mockFetch as unknown as typeof fetch,
        )) {
          // iterate
        }
      }).rejects.toThrow(AiDisabledException);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    // Defeito 4: Groq como primária respeita AI_MODEL
    it('Defeito 4: Groq as primary respects ai.model instead of defaulting to fallbackModel', async () => {
      let capturedBody: { model: string } | null = null;
      const mockFetch = jest.fn().mockImplementation((_url, opts) => {
        capturedBody = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: 'ok' } }],
            usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
          }),
        });
      });

      service = createService(
        {
          'ai.provider': 'groq',
          'ai.model': 'chosen-primary',
          'ai.fallbackModel': 'chosen-fallback',
        },
        mockFetch as unknown as typeof fetch,
      );

      await service.chat(
        {
          context: defaultContext,
          messages: [{ role: 'user', content: 'Pergunta para Groq primário' }],
        },
        mockFetch as unknown as typeof fetch,
      );

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.model).toBe('chosen-primary');
    });

    // Defeito 5: Falha de banco ao checar ou gravar orçamento falha FECHADA
    it('Defeito 5: database failure during budget aggregate fails closed and blocks external call', async () => {
      const mockFetch = jest.fn();
      service = createService({}, mockFetch as unknown as typeof fetch);

      prismaMock.aiRun.aggregate.mockRejectedValueOnce(new Error('synthetic DB unavailable'));

      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'teste' }],
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiProviderUnavailableException);

      // Provider was NOT called
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Defeito 5 (gravação): database failure during startRun fails closed and blocks external call', async () => {
      const mockFetch = jest.fn();
      service = createService({}, mockFetch as unknown as typeof fetch);

      prismaMock.aiRun.create.mockRejectedValueOnce(new Error('synthetic DB insert failure'));

      await expect(
        service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'teste' }],
          },
          mockFetch as unknown as typeof fetch,
        ),
      ).rejects.toThrow(AiProviderUnavailableException);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    // Defeito 6: Reserva cobre streaming quando primário falha antes de emitir deltas
    it('Defeito 6: streamChat falls back to Groq stream when primary Cloudflare returns 429', async () => {
      let callCount = 0;
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        callCount++;
        if (url.includes('cloudflare.com')) {
          // Cloudflare returns 429
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => 'Cloudflare rate limit',
          });
        }
        if (url.includes('api.groq.com')) {
          // Groq succeeds with streaming
          const sseContent =
            'data: {"choices":[{"delta":{"content":"Resposta via Groq stream"}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}\n\ndata: [DONE]\n\n';
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(sseContent));
              controller.close();
            },
          });
          return Promise.resolve({
            ok: true,
            status: 200,
            body: stream,
          });
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      service = createService(
        {
          'ai.provider': 'cloudflare',
          'ai.fallbackProvider': 'groq',
          'ai.fallbackModel': 'openai/gpt-oss-120b',
        },
        mockFetch as unknown as typeof fetch,
      );

      const chunks: string[] = [];
      for await (const chunk of service.streamChat(
        {
          context: defaultContext,
          messages: [{ role: 'user', content: 'Pergunta streaming com fallback' }],
        },
        mockFetch as unknown as typeof fetch,
      )) {
        if (chunk.contentDelta) chunks.push(chunk.contentDelta);
      }

      expect(callCount).toBe(2); // 1: Cloudflare (429) -> 2: Groq (200)
      expect(chunks.join('')).toBe('Resposta via Groq stream');

      // Verify Groq URL and headers were used
      const groqCall = mockFetch.mock.calls.find(([url]) => url.includes('api.groq.com'));
      expect(groqCall).toBeDefined();
      expect(groqCall[1].headers.Authorization).toBe('Bearer gsk-test-key');

      // Verify AiRun completed with groq provider
      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AiRunStatus.COMPLETED,
            provider: 'groq',
            model: 'openai/gpt-oss-120b',
          }),
        }),
      );
    });

    it('Defeito 6 (both fail): streamChat calls both primary and fallback if both return 429', async () => {
      let callCount = 0;
      const mockFetch = jest.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        });
      });

      service = createService(
        {
          'ai.provider': 'cloudflare',
          'ai.fallbackProvider': 'groq',
        },
        mockFetch as unknown as typeof fetch,
      );

      await expect(async () => {
        for await (const _chunk of service.streamChat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Stream double 429' }],
          },
          mockFetch as unknown as typeof fetch,
        )) {
          // iterate
        }
      }).rejects.toThrow(AiRateLimitException);

      expect(callCount).toBe(2); // Called Cloudflare then called Groq
    });
  });

  describe('Defeitos Residuais (QA Rodada 2)', () => {
    it('Defeito R1 (abort): stream interrupted after partial usage records AiRun with partial usage and consumes budget', async () => {
      const mockFetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: new ReadableStream({
            start(c) {
              c.enqueue(
                new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"ok"}}],"usage":{"prompt_tokens":70,"completion_tokens":70,"total_tokens":140}}\n\n',
                ),
              );
              c.enqueue(
                new TextEncoder().encode('data: {"choices":[{"delta":{"content":"more"}}]}\n\n'),
              );
            },
          }),
        });
      });

      service = createService(
        {
          'ai.dailyBudgetTokens': 100,
        },
        mockFetch as unknown as typeof fetch,
      );

      // Initial budget check: 0 tokens
      prismaMock.aiRun.aggregate.mockResolvedValueOnce({
        _sum: { inputTokens: 0, outputTokens: 0 },
      });

      // Stream 1: Consumer breaks on first chunk
      for await (const _chunk of service.streamChat(
        {
          context: defaultContext,
          messages: [{ role: 'user', content: 'Break after first chunk' }],
        },
        mockFetch as unknown as typeof fetch,
      )) {
        break;
      }

      // Verify AiRun was updated with partial usage even on STREAM_ABORTED
      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AiRunStatus.FAILED,
            errorCode: 'STREAM_ABORTED',
            inputTokens: 70,
            outputTokens: 70,
          }),
        }),
      );
    });

    it('Defeito R1 (read error): stream read error records AiRun with partial usage', async () => {
      let first = true;
      const mockFetch = jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: new ReadableStream({
            pull(c) {
              if (first) {
                first = false;
                c.enqueue(
                  new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"ok"}}],"usage":{"prompt_tokens":70,"completion_tokens":70,"total_tokens":140}}\n\n',
                  ),
                );
              } else {
                c.error(new Error('synthetic stream read error'));
              }
            },
          }),
        });
      });

      service = createService({}, mockFetch as unknown as typeof fetch);

      await expect(async () => {
        for await (const _chunk of service.streamChat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Stream error test' }],
          },
          mockFetch as unknown as typeof fetch,
        )) {
          // iterate
        }
      }).rejects.toThrow();

      expect(prismaMock.aiRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: AiRunStatus.FAILED,
            inputTokens: 70,
            outputTokens: 70,
          }),
        }),
      );
    });

    it('Defeito R2 (generator close): streamChat closes upstream generator on consumer break', async () => {
      let upstreamClosed = 0;
      const fakeClient = {
        complete: jest.fn(),
        stream: async function* () {
          try {
            yield { contentDelta: 'chunk 1' };
            yield { contentDelta: 'chunk 2' };
          } finally {
            upstreamClosed++;
          }
        },
      };

      service = createService();
      (service as unknown as { client: unknown }).client = fakeClient;

      for await (const _chunk of service.streamChat({
        context: defaultContext,
        messages: [{ role: 'user', content: 'Test break' }],
      })) {
        break;
      }

      expect(upstreamClosed).toBe(1);
    });

    it.each([false, true])(
      'Defeito R3 (error metadata): sanitizes upstream error messages when fallback failure is %s',
      async (fallbackFails) => {
        service = createService({ 'ai.maxRetries': 0 });
        const sentinel = 'QA_UPSTREAM_PRIVATE_SENTINEL';
        const complete = jest
          .spyOn(client, 'complete')
          .mockRejectedValueOnce(new AiProviderUnavailableException(sentinel));
        if (fallbackFails)
          complete.mockRejectedValueOnce(new AiProviderUnavailableException(sentinel));
        else
          complete.mockResolvedValueOnce({
            content: 'ok',
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          });
        const capturedWarns: unknown[] = [];
        const warn = jest
          .spyOn(
            (service as unknown as { logger: { warn: (value: unknown) => void } }).logger,
            'warn',
          )
          .mockImplementation((value) => {
            capturedWarns.push(value);
          });
        try {
          const call = service.chat({
            context: defaultContext,
            messages: [{ role: 'user', content: 'Hi' }],
          });
          if (fallbackFails) await expect(call).rejects.toThrow(AiProviderUnavailableException);
          else await expect(call).resolves.toEqual(expect.objectContaining({ provider: 'groq' }));
          expect(complete).toHaveBeenCalledTimes(2);
          expect(capturedWarns.length).toBeGreaterThan(0);
          expect(JSON.stringify(capturedWarns)).not.toContain(sentinel);
        } finally {
          warn.mockRestore();
          complete.mockRestore();
        }
      },
    );

    it('Defeito R3 (logging): fallback logs do not include raw malformed response content / PII', async () => {
      const rawMalformedPII = 'QA_PII';
      let calls = 0;
      const mockFetch = jest.fn().mockImplementation(() => {
        calls++;
        if (calls === 1) {
          return Promise.resolve(new Response(rawMalformedPII));
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"status":"ok"}' } }],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          ),
        );
      });

      service = createService(
        {
          'ai.provider': 'cloudflare',
          'ai.fallbackProvider': 'groq',
          'ai.maxRetries': 0,
        },
        mockFetch as unknown as typeof fetch,
      );

      const capturedWarns: unknown[] = [];
      const warnSpy = jest
        .spyOn((service as unknown as { logger: { warn: (msg: unknown) => void } }).logger, 'warn')
        .mockImplementation((val) => {
          capturedWarns.push(val);
        });

      try {
        await service.chat(
          {
            context: defaultContext,
            messages: [{ role: 'user', content: 'Pergunta' }],
          },
          mockFetch as unknown as typeof fetch,
        );

        expect(calls).toBe(2);
        expect(capturedWarns.length).toBeGreaterThan(0);
        expect(JSON.stringify(capturedWarns)).not.toContain(rawMalformedPII);
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
