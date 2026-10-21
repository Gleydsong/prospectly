import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { sanitizeLlmPayload } from '../../privacy/llm-privacy.sanitizer';
import { LlmBudgetService } from './llm-budget.service';
import { LlmTelemetryService } from './llm-telemetry.service';
import { OpenAiCompatibleClient } from './openai-compatible.client';
import {
  AiDisabledException,
  AiException,
  AiFallbackProviderType,
  AiInvalidStructuredOutputException,
  AiProviderType,
  AiProviderUnavailableException,
  AiRateLimitException,
  AiTimeoutException,
  LlmChatRequest,
  LlmChatResponse,
  LlmMessage,
  LlmStreamChunk,
  LlmStructuredRequest,
  LlmStructuredResponse,
  LlmTool,
  LlmUsage,
} from './llm-provider.types';

@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly budgetService: LlmBudgetService,
    private readonly telemetry: LlmTelemetryService,
    private readonly client: OpenAiCompatibleClient,
  ) {}

  getProvider(): AiProviderType {
    const raw = this.config.get<string>('ai.provider') ?? 'disabled';
    const lower = raw.toLowerCase().trim();
    if (lower === 'cloudflare' || lower === 'groq' || lower === 'disabled') {
      return lower;
    }
    return 'disabled';
  }

  isAiEnabled(): boolean {
    return this.getProvider() !== 'disabled';
  }

  getFallbackProvider(): AiFallbackProviderType {
    const raw = this.config.get<string>('ai.fallbackProvider') ?? 'none';
    const lower = raw.toLowerCase().trim();
    if (lower === 'groq' || lower === 'none' || lower === 'disabled') {
      return lower;
    }
    return 'none';
  }

  private sanitizeMessage(msg: LlmMessage): LlmMessage {
    const sanitizedObj = sanitizeLlmPayload(msg) as LlmMessage;
    let content = sanitizedObj.content;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed !== null && typeof parsed === 'object') {
            const sanitizedParsed = sanitizeLlmPayload(parsed);
            content = JSON.stringify(sanitizedParsed);
          }
        } catch {
          // Keep original content if parsing fails
        }
      }
    }
    return {
      ...sanitizedObj,
      content,
    };
  }

  private sanitizeMessages(messages: LlmMessage[]): LlmMessage[] {
    return messages.map((m) => this.sanitizeMessage(m));
  }

  private sanitizeErrorMetadata(error: unknown): {
    code: string;
    message: string;
    name: string;
  } {
    if (error instanceof AiTimeoutException) {
      return { code: error.code, message: 'Request timed out', name: error.name };
    }
    if (error instanceof AiRateLimitException) {
      return { code: error.code, message: 'Rate limit exceeded (HTTP 429)', name: error.name };
    }
    if (error instanceof AiProviderUnavailableException) {
      return {
        code: error.code,
        message: 'Provider unavailable or returned invalid response',
        name: error.name,
      };
    }
    if (error instanceof AiDisabledException) {
      return { code: error.code, message: 'Provider disabled', name: error.name };
    }
    if (error instanceof AiException) {
      return { code: error.code, message: error.code, name: error.name };
    }
    if (error instanceof SyntaxError) {
      return {
        code: 'INVALID_JSON_RESPONSE',
        message: 'Malformed JSON response',
        name: 'SyntaxError',
      };
    }
    if (error instanceof Error) {
      return { code: 'AI_PROVIDER_ERROR', message: error.name, name: error.name };
    }
    return { code: 'AI_UNKNOWN_ERROR', message: 'Unknown error', name: 'Error' };
  }

  private resolveEndpointConfig(provider: AiProviderType, isFallback = false) {
    if (provider === 'cloudflare') {
      const accountId = this.config.get<string>('ai.cloudflare.accountId') ?? '';
      const baseUrl =
        this.config.get<string>('ai.cloudflare.baseUrl') ??
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`;
      const apiKey = this.config.get<string>('ai.cloudflare.apiToken') ?? '';
      const defaultModel = isFallback
        ? (this.config.get<string>('ai.fallbackModel') ?? '@cf/openai/gpt-oss-120b')
        : (this.config.get<string>('ai.model') ?? '@cf/openai/gpt-oss-120b');
      return { baseUrl, apiKey, defaultModel };
    }

    if (provider === 'groq') {
      const baseUrl =
        this.config.get<string>('ai.groq.baseUrl') ?? 'https://api.groq.com/openai/v1';
      const apiKey = this.config.get<string>('ai.groq.apiKey') ?? '';
      const defaultModel = isFallback
        ? (this.config.get<string>('ai.fallbackModel') ?? 'openai/gpt-oss-120b')
        : (this.config.get<string>('ai.model') ?? 'openai/gpt-oss-120b');
      return { baseUrl, apiKey, defaultModel };
    }

    return null;
  }

  async chat(req: LlmChatRequest, customFetch?: typeof fetch): Promise<LlmChatResponse> {
    if (this.getProvider() === 'disabled') {
      throw new AiDisabledException('AI provider is currently disabled');
    }
    const primaryProvider = req.provider ?? this.getProvider();
    if (primaryProvider === 'disabled') {
      throw new AiDisabledException('AI provider is currently disabled');
    }

    await this.budgetService.checkBudget(req.context.organizationId);

    const fallback = this.getFallbackProvider();
    const primaryConfig = this.resolveEndpointConfig(primaryProvider, false);
    if (!primaryConfig) {
      throw new AiProviderUnavailableException(`Unsupported primary provider: ${primaryProvider}`);
    }

    const primaryModel = req.model ?? primaryConfig.defaultModel;
    const timeoutMs = this.config.get<number>('ai.timeoutMs') ?? 30_000;
    const maxRetries = this.config.get<number>('ai.maxRetries') ?? 2;
    const started = Date.now();

    const sanitizedMessages = this.sanitizeMessages(req.messages);
    const sanitizedTools = req.tools ? (sanitizeLlmPayload(req.tools) as LlmTool[]) : undefined;

    const runId = await this.telemetry.startRun(req.context, primaryProvider, primaryModel);

    // Try primary provider with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const raw = await this.client.complete(
          {
            baseUrl: primaryConfig.baseUrl,
            apiKey: primaryConfig.apiKey,
            model: primaryModel,
            messages: sanitizedMessages,
            tools: sanitizedTools,
            responseFormat: req.responseFormat,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
            timeoutMs,
            signal: req.signal,
          },
          customFetch,
        );

        const durationMs = Date.now() - started;
        if (!req.deferTelemetry) {
          await this.telemetry.completeRun({
            runId,
            provider: primaryProvider,
            model: primaryModel,
            usage: raw.usage,
            durationMs,
            fallbackUsed: false,
            task: req.context.task,
          });
        }

        return {
          runId,
          content: raw.content,
          toolCalls: raw.toolCalls,
          usage: raw.usage,
          provider: primaryProvider,
          model: primaryModel,
          durationMs,
          fallbackUsed: false,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // If 429, timeout or 5xx, consider retrying or falling back
        const isRetryable =
          error instanceof AiTimeoutException ||
          error instanceof AiRateLimitException ||
          error instanceof AiProviderUnavailableException;

        if (!isRetryable || req.signal?.aborted || attempt === maxRetries) {
          break;
        }
      }
    }

    // Attempt fallback to Groq if configured and primary was Cloudflare
    if (
      fallback === 'groq' &&
      primaryProvider === 'cloudflare' &&
      lastError &&
      !req.signal?.aborted
    ) {
      const errorMeta = this.sanitizeErrorMetadata(lastError);
      this.logger.warn({
        message: 'Primary provider failed, attempting fallback to Groq',
        primaryProvider,
        primaryError: errorMeta.message,
        errorCode: errorMeta.code,
        task: req.context.task,
      });

      const groqConfig = this.resolveEndpointConfig('groq', true);
      if (groqConfig) {
        const groqModel = this.config.get<string>('ai.fallbackModel') ?? groqConfig.defaultModel;

        try {
          const rawFallback = await this.client.complete(
            {
              baseUrl: groqConfig.baseUrl,
              apiKey: groqConfig.apiKey,
              model: groqModel,
              messages: sanitizedMessages,
              tools: sanitizedTools,
              responseFormat: req.responseFormat,
              temperature: req.temperature,
              maxTokens: req.maxTokens,
              timeoutMs,
              signal: req.signal,
            },
            customFetch,
          );

          const durationMs = Date.now() - started;
          if (!req.deferTelemetry) {
            await this.telemetry.completeRun({
              runId,
              provider: 'groq',
              model: groqModel,
              usage: rawFallback.usage,
              durationMs,
              fallbackUsed: true,
              task: req.context.task,
            });
          }

          return {
            runId,
            content: rawFallback.content,
            toolCalls: rawFallback.toolCalls,
            usage: rawFallback.usage,
            provider: 'groq',
            model: groqModel,
            durationMs,
            fallbackUsed: true,
          };
        } catch (fallbackError) {
          const fallbackErrorMeta = this.sanitizeErrorMetadata(fallbackError);
          this.logger.warn({
            message: 'Fallback provider Groq also failed',
            error: fallbackErrorMeta.message,
            errorCode: fallbackErrorMeta.code,
          });
          lastError =
            fallbackError instanceof Error ? fallbackError : new Error(fallbackErrorMeta.message);
        }
      }
    }

    // Both primary and fallback failed (or no fallback)
    const durationMs = Date.now() - started;
    const errorMeta = this.sanitizeErrorMetadata(lastError);
    await this.telemetry.failRun({
      runId,
      provider: primaryProvider,
      model: primaryModel,
      errorCode: errorMeta.code,
      durationMs,
      fallbackUsed: false,
      task: req.context.task,
    });

    throw lastError ?? new AiProviderUnavailableException('All AI provider attempts failed');
  }

  async generateStructured<T>(
    req: LlmStructuredRequest<T>,
    customFetch?: typeof fetch,
  ): Promise<LlmStructuredResponse<T>> {
    if (!this.isAiEnabled()) {
      throw new AiDisabledException('AI provider is currently disabled');
    }

    const sanitizedInput = sanitizeLlmPayload(req.input);
    const messages: LlmMessage[] = [
      { role: 'system', content: req.system },
      { role: 'user', content: JSON.stringify(sanitizedInput) },
    ];

    const context = {
      ...req.context,
      task: req.task ?? req.context.task ?? 'STRUCTURED_OUTPUT',
      promptVersion: req.promptVersion ?? req.context.promptVersion ?? 'v1',
    };

    // First attempt
    const firstResponse = await this.chat(
      {
        context,
        messages,
        model: req.model,
        temperature: req.temperature ?? 0.2,
        maxTokens: req.maxTokens,
        responseFormat: { type: 'json_object' },
        deferTelemetry: true,
      },
      customFetch,
    );

    const parseResult1 = this.tryParseAndValidate(firstResponse.content, req.schema);
    if (parseResult1.success) {
      await this.telemetry.completeRun({
        runId: firstResponse.runId ?? null,
        provider: firstResponse.provider,
        model: firstResponse.model,
        usage: firstResponse.usage,
        durationMs: firstResponse.durationMs,
        fallbackUsed: firstResponse.fallbackUsed,
        task: context.task,
      });

      return {
        data: parseResult1.data,
        usage: firstResponse.usage,
        provider: firstResponse.provider,
        model: firstResponse.model,
        durationMs: firstResponse.durationMs,
        fallbackUsed: firstResponse.fallbackUsed,
        retriesCount: 0,
      };
    }

    await this.telemetry.failRun({
      runId: firstResponse.runId ?? null,
      provider: firstResponse.provider,
      model: firstResponse.model,
      errorCode: 'AI_INVALID_STRUCTURED_OUTPUT',
      durationMs: firstResponse.durationMs,
      fallbackUsed: firstResponse.fallbackUsed,
      task: context.task,
      usage: firstResponse.usage,
    });

    // Single limited correction retry on invalid JSON / schema
    this.logger.warn({
      message: 'Initial JSON structured output validation failed, retrying with correction prompt',
      task: context.task,
    });

    const retryMessages: LlmMessage[] = [
      ...messages,
      { role: 'assistant', content: firstResponse.content ?? '' },
      {
        role: 'user',
        content:
          'A resposta anterior não obedeceu ao formato JSON esperado. Por favor responda estritamente com JSON válido que satisfaça o schema.',
      },
    ];

    const retryResponse = await this.chat(
      {
        context,
        messages: retryMessages,
        model: req.model,
        temperature: 0.1,
        maxTokens: req.maxTokens,
        responseFormat: { type: 'json_object' },
        deferTelemetry: true,
      },
      customFetch,
    );

    const parseResult2 = this.tryParseAndValidate(retryResponse.content, req.schema);
    if (parseResult2.success) {
      await this.telemetry.completeRun({
        runId: retryResponse.runId ?? null,
        provider: retryResponse.provider,
        model: retryResponse.model,
        usage: retryResponse.usage,
        durationMs: retryResponse.durationMs,
        fallbackUsed: retryResponse.fallbackUsed,
        task: context.task,
      });

      return {
        data: parseResult2.data,
        usage: {
          promptTokens: firstResponse.usage.promptTokens + retryResponse.usage.promptTokens,
          completionTokens:
            firstResponse.usage.completionTokens + retryResponse.usage.completionTokens,
          totalTokens: firstResponse.usage.totalTokens + retryResponse.usage.totalTokens,
        },
        provider: retryResponse.provider,
        model: retryResponse.model,
        durationMs: firstResponse.durationMs + retryResponse.durationMs,
        fallbackUsed: retryResponse.fallbackUsed,
        retriesCount: 1,
      };
    }

    await this.telemetry.failRun({
      runId: retryResponse.runId ?? null,
      provider: retryResponse.provider,
      model: retryResponse.model,
      errorCode: 'AI_INVALID_STRUCTURED_OUTPUT',
      durationMs: retryResponse.durationMs,
      fallbackUsed: retryResponse.fallbackUsed,
      task: context.task,
      usage: retryResponse.usage,
    });

    throw new AiInvalidStructuredOutputException(
      'AI output failed structured schema validation after retry',
      parseResult2.error,
    );
  }

  async *streamChat(
    req: LlmChatRequest,
    customFetch?: typeof fetch,
  ): AsyncIterable<LlmStreamChunk> {
    if (this.getProvider() === 'disabled') {
      throw new AiDisabledException('AI provider is currently disabled');
    }
    const primaryProvider = req.provider ?? this.getProvider();
    if (primaryProvider === 'disabled') {
      throw new AiDisabledException('AI provider is currently disabled');
    }

    await this.budgetService.checkBudget(req.context.organizationId);

    const fallback = this.getFallbackProvider();
    const primaryConfig = this.resolveEndpointConfig(primaryProvider, false);
    if (!primaryConfig) {
      throw new AiProviderUnavailableException(`Unsupported primary provider: ${primaryProvider}`);
    }

    const primaryModel = req.model ?? primaryConfig.defaultModel;
    const timeoutMs = this.config.get<number>('ai.timeoutMs') ?? 30_000;
    const started = Date.now();

    const sanitizedMessages = this.sanitizeMessages(req.messages);
    const sanitizedTools = req.tools ? (sanitizeLlmPayload(req.tools) as LlmTool[]) : undefined;

    const runId = await this.telemetry.startRun(req.context, primaryProvider, primaryModel);

    let effectiveProvider: AiProviderType = primaryProvider;
    let effectiveModel = primaryModel;
    let fallbackUsed = false;
    let accumulatedUsage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let hasUsage = false;
    let accumulatedContent = '';

    const primaryStream = this.client.stream(
      {
        baseUrl: primaryConfig.baseUrl,
        apiKey: primaryConfig.apiKey,
        model: primaryModel,
        messages: sanitizedMessages,
        tools: sanitizedTools,
        responseFormat: req.responseFormat,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
        timeoutMs,
        signal: req.signal,
      },
      customFetch,
    );

    let activeIterator: AsyncIterator<LlmStreamChunk> = primaryStream[Symbol.asyncIterator]();
    let firstChunk: IteratorResult<LlmStreamChunk>;

    try {
      firstChunk = await activeIterator.next();
    } catch (rawPrimaryError: unknown) {
      const primaryError =
        rawPrimaryError instanceof Error ? rawPrimaryError : new Error(String(rawPrimaryError));
      const isRetryable =
        primaryError instanceof AiTimeoutException ||
        primaryError instanceof AiRateLimitException ||
        primaryError instanceof AiProviderUnavailableException;

      if (
        fallback === 'groq' &&
        primaryProvider === 'cloudflare' &&
        isRetryable &&
        !req.signal?.aborted
      ) {
        const errorMeta = this.sanitizeErrorMetadata(primaryError);
        this.logger.warn({
          message:
            'Primary streaming provider failed before emitting deltas, attempting fallback to Groq',
          primaryProvider,
          primaryError: errorMeta.message,
          errorCode: errorMeta.code,
          task: req.context.task,
        });

        const groqConfig = this.resolveEndpointConfig('groq', true);
        if (groqConfig) {
          const groqModel = this.config.get<string>('ai.fallbackModel') ?? groqConfig.defaultModel;
          effectiveProvider = 'groq';
          effectiveModel = groqModel;
          fallbackUsed = true;

          const fallbackStream = this.client.stream(
            {
              baseUrl: groqConfig.baseUrl,
              apiKey: groqConfig.apiKey,
              model: groqModel,
              messages: sanitizedMessages,
              tools: sanitizedTools,
              responseFormat: req.responseFormat,
              temperature: req.temperature,
              maxTokens: req.maxTokens,
              timeoutMs,
              signal: req.signal,
            },
            customFetch,
          );
          activeIterator = fallbackStream[Symbol.asyncIterator]();
          try {
            firstChunk = await activeIterator.next();
          } catch (rawFallbackError: unknown) {
            const fallbackError =
              rawFallbackError instanceof Error
                ? rawFallbackError
                : new Error(String(rawFallbackError));
            const durationMs = Date.now() - started;
            const fallbackErrorMeta = this.sanitizeErrorMetadata(fallbackError);
            await this.telemetry.failRun({
              runId,
              provider: 'groq',
              model: groqModel,
              errorCode: fallbackErrorMeta.code,
              durationMs,
              fallbackUsed: true,
              task: req.context.task,
            });
            throw fallbackError;
          }
        } else {
          const durationMs = Date.now() - started;
          const errorMeta = this.sanitizeErrorMetadata(primaryError);
          await this.telemetry.failRun({
            runId,
            provider: primaryProvider,
            model: primaryModel,
            errorCode: errorMeta.code,
            durationMs,
            fallbackUsed: false,
            task: req.context.task,
          });
          throw primaryError;
        }
      } else {
        const durationMs = Date.now() - started;
        const errorMeta = this.sanitizeErrorMetadata(primaryError);
        await this.telemetry.failRun({
          runId,
          provider: primaryProvider,
          model: primaryModel,
          errorCode: errorMeta.code,
          durationMs,
          fallbackUsed: false,
          task: req.context.task,
        });
        throw primaryError;
      }
    }

    const getPartialUsage = (): LlmUsage | undefined => {
      if (hasUsage) {
        return accumulatedUsage;
      }
      if (accumulatedContent.length > 0) {
        const estimatedPrompt = Math.max(
          1,
          Math.ceil(JSON.stringify(sanitizedMessages).length / 4),
        );
        const estimatedCompletion = Math.max(1, Math.ceil(accumulatedContent.length / 4));
        return {
          promptTokens: estimatedPrompt,
          completionTokens: estimatedCompletion,
          totalTokens: estimatedPrompt + estimatedCompletion,
        };
      }
      return undefined;
    };

    let isCompleted = false;
    try {
      while (!firstChunk.done) {
        const chunk = firstChunk.value;
        if (chunk.contentDelta) {
          accumulatedContent += chunk.contentDelta;
        }
        if (chunk.usage) {
          accumulatedUsage = chunk.usage;
          hasUsage = true;
        }
        yield chunk;
        firstChunk = await activeIterator.next();
      }

      if (!hasUsage) {
        const estimatedPrompt = Math.max(
          1,
          Math.ceil(JSON.stringify(sanitizedMessages).length / 4),
        );
        const estimatedCompletion = Math.max(1, Math.ceil(accumulatedContent.length / 4));
        accumulatedUsage = {
          promptTokens: estimatedPrompt,
          completionTokens: estimatedCompletion,
          totalTokens: estimatedPrompt + estimatedCompletion,
        };
      }

      isCompleted = true;
      const durationMs = Date.now() - started;
      await this.telemetry.completeRun({
        runId,
        provider: effectiveProvider,
        model: effectiveModel,
        usage: accumulatedUsage,
        durationMs,
        fallbackUsed,
        task: req.context.task,
      });
    } catch (streamError) {
      isCompleted = true;
      const durationMs = Date.now() - started;
      const errorMeta = this.sanitizeErrorMetadata(streamError);
      const partialUsage = getPartialUsage();
      await this.telemetry.failRun({
        runId,
        provider: effectiveProvider,
        model: effectiveModel,
        errorCode: errorMeta.code,
        durationMs,
        fallbackUsed,
        task: req.context.task,
        usage: partialUsage,
      });
      throw streamError;
    } finally {
      try {
        await activeIterator.return?.();
      } catch {
        // ignore
      }
      if (!isCompleted) {
        isCompleted = true;
        const durationMs = Date.now() - started;
        const partialUsage = getPartialUsage();
        await this.telemetry.failRun({
          runId,
          provider: effectiveProvider,
          model: effectiveModel,
          errorCode: 'STREAM_ABORTED',
          durationMs,
          fallbackUsed,
          task: req.context.task,
          usage: partialUsage,
        });
      }
    }
  }

  private tryParseAndValidate<T>(
    rawContent: string | null,
    schema: {
      safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
    },
  ): { success: true; data: T } | { success: false; error: unknown } {
    if (!rawContent || rawContent.trim().length === 0) {
      return { success: false, error: 'Empty output from model' };
    }

    try {
      // Strip markdown code fences if model returned ```json ... ```
      const cleaned = rawContent
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
      const json = JSON.parse(cleaned);
      return schema.safeParse(json);
    } catch (error) {
      return { success: false, error };
    }
  }
}
