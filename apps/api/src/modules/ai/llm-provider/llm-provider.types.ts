import { z } from 'zod';

export type AiProviderType = 'cloudflare' | 'groq' | 'disabled';
export type AiFallbackProviderType = 'groq' | 'none' | 'disabled';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface LlmToolFunction {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface LlmTool {
  type: 'function';
  function: LlmToolFunction;
}

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LlmCallContext {
  organizationId: string;
  userId?: string;
  opportunityRunId?: string;
  candidateId?: string;
  task?: string;
  promptVersion?: string;
}

export interface LlmChatRequest {
  context: LlmCallContext;
  messages: LlmMessage[];
  tools?: LlmTool[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: Record<string, unknown>;
  };
  model?: string;
  provider?: AiProviderType;
  stream?: boolean;
  signal?: AbortSignal;
  deferTelemetry?: boolean;
}

export interface LlmChatResponse {
  runId?: string | null;
  content: string | null;
  toolCalls?: LlmToolCall[];
  usage: LlmUsage;
  provider: AiProviderType;
  model: string;
  durationMs: number;
  fallbackUsed: boolean;
}

export interface LlmStreamChunk {
  contentDelta?: string;
  toolCallsDelta?: Array<{
    index: number;
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  isDone: boolean;
  usage?: LlmUsage;
}

export interface LlmStructuredRequest<T> {
  context: LlmCallContext;
  schema: z.ZodType<T>;
  system: string;
  input: unknown;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  promptVersion?: string;
  task?: string;
}

export interface LlmStructuredResponse<T> {
  data: T;
  usage: LlmUsage;
  provider: AiProviderType;
  model: string;
  durationMs: number;
  fallbackUsed: boolean;
  retriesCount: number;
}

// Exception hierarchy
export class AiException extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AiException';
  }
}

export class AiDisabledException extends AiException {
  constructor(message = 'AI provider is disabled') {
    super(message, 'AI_DISABLED');
    this.name = 'AiDisabledException';
  }
}

export class AiBudgetExceededException extends AiException {
  constructor(
    message: string,
    public readonly organizationId: string,
    public readonly usedTokens: number,
    public readonly limitTokens: number,
  ) {
    super(message, 'AI_BUDGET_EXCEEDED');
    this.name = 'AiBudgetExceededException';
  }
}

export class AiRateLimitException extends AiException {
  constructor(
    message = 'AI rate limit exceeded (HTTP 429)',
    public readonly status = 429,
  ) {
    super(message, 'AI_RATE_LIMIT');
    this.name = 'AiRateLimitException';
  }
}

export class AiRequestAbortedException extends AiException {
  constructor() {
    super('AI request was cancelled by the caller', 'AI_REQUEST_ABORTED');
    this.name = 'AiRequestAbortedException';
  }
}

export class AiTimeoutException extends AiException {
  constructor(
    message = 'AI request timed out',
    public readonly timeoutMs?: number,
  ) {
    super(message, 'AI_TIMEOUT');
    this.name = 'AiTimeoutException';
  }
}

export class AiInvalidStructuredOutputException extends AiException {
  constructor(
    message = 'AI output failed structured schema validation',
    public readonly details?: unknown,
  ) {
    super(message, 'AI_INVALID_STRUCTURED_OUTPUT');
    this.name = 'AiInvalidStructuredOutputException';
  }
}

export class AiProviderUnavailableException extends AiException {
  constructor(
    message = 'AI provider is unavailable',
    public readonly provider?: string,
    public readonly cause?: Error,
  ) {
    super(message, 'AI_PROVIDER_UNAVAILABLE');
    this.name = 'AiProviderUnavailableException';
  }
}
