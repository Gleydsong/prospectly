import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AssistantSpikeGuard } from './assistant-spike.guard';

describe('AssistantSpikeGuard', () => {
  function createMockContext(query: Record<string, unknown> = {}): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ query }),
      }),
    } as unknown as ExecutionContext;
  }

  it('throws NotFoundException (404) when ASSISTANT_SPIKE_ENABLED is not set or false', () => {
    const config = {
      get: (key: string) => (key === 'ASSISTANT_SPIKE_ENABLED' ? 'false' : undefined),
    } as unknown as ConfigService;

    const guard = new AssistantSpikeGuard(config);
    expect(() => guard.canActivate(createMockContext())).toThrow(NotFoundException);
  });

  it('allows request when ASSISTANT_SPIKE_ENABLED is true and no query tokens are present', () => {
    const config = {
      get: (key: string) => (key === 'ASSISTANT_SPIKE_ENABLED' ? 'true' : undefined),
    } as unknown as ConfigService;

    const guard = new AssistantSpikeGuard(config);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('throws UnauthorizedException (401) when token is passed in query string', () => {
    const config = {
      get: (key: string) => (key === 'ASSISTANT_SPIKE_ENABLED' ? 'true' : undefined),
    } as unknown as ConfigService;

    const guard = new AssistantSpikeGuard(config);
    expect(() => guard.canActivate(createMockContext({ token: 'xyz123' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException (401) when jwt is passed in query string', () => {
    const config = {
      get: (key: string) => (key === 'ASSISTANT_SPIKE_ENABLED' ? 'true' : undefined),
    } as unknown as ConfigService;

    const guard = new AssistantSpikeGuard(config);
    expect(() => guard.canActivate(createMockContext({ jwt: 'xyz123' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException (401) when access_token is passed in query string', () => {
    const config = {
      get: (key: string) => (key === 'ASSISTANT_SPIKE_ENABLED' ? 'true' : undefined),
    } as unknown as ConfigService;

    const guard = new AssistantSpikeGuard(config);
    expect(() => guard.canActivate(createMockContext({ access_token: 'xyz123' }))).toThrow(
      UnauthorizedException,
    );
  });
});
