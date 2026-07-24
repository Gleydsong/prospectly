export class SearchProviderError extends Error {
  readonly retryable: boolean;
  readonly publicMessage: string;
  readonly statusCode?: number;
  readonly reason?: string;
  readonly provider: string;

  constructor(params: {
    provider: string;
    message: string;
    publicMessage: string;
    retryable: boolean;
    statusCode?: number;
    reason?: string;
  }) {
    super(params.message);
    this.name = 'SearchProviderError';
    this.provider = params.provider;
    this.publicMessage = params.publicMessage;
    this.retryable = params.retryable;
    this.statusCode = params.statusCode;
    this.reason = params.reason;
  }
}

export function isSearchProviderError(error: unknown): error is SearchProviderError {
  return error instanceof SearchProviderError;
}
