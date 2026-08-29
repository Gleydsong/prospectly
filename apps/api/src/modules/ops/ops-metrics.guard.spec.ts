import type { ExecutionContext } from '@nestjs/common';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';

import { OPS_METRICS_TOKEN_HEADER } from './ops-metrics.constants';
import { OpsMetricsGuard } from './ops-metrics.guard';

const TOKEN = 'ops-metrics-token-min-32-chars!!';

const makeContext = (headers: Record<string, string | string[] | undefined>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as unknown as ExecutionContext;

const makeConfig = (token: string | undefined) =>
  ({
    get: (key: string) => (key === 'ops.metricsToken' ? token : undefined),
  }) as never;

describe('OpsMetricsGuard', () => {
  it('hides the endpoint when the platform token is not configured', () => {
    const guard = new OpsMetricsGuard(makeConfig(''));
    expect(() => guard.canActivate(makeContext({}))).toThrow(NotFoundException);
  });

  it('hides the endpoint when the configured token is too short', () => {
    const guard = new OpsMetricsGuard(makeConfig('short-token'));
    expect(() =>
      guard.canActivate(makeContext({ [OPS_METRICS_TOKEN_HEADER]: 'short-token' })),
    ).toThrow(NotFoundException);
  });

  it('rejects a missing or wrong token without leaking whether a value is set', () => {
    const guard = new OpsMetricsGuard(makeConfig(TOKEN));
    expect(() => guard.canActivate(makeContext({}))).toThrow(UnauthorizedException);
    expect(() =>
      guard.canActivate(makeContext({ [OPS_METRICS_TOKEN_HEADER]: 'wrong-ops-metrics-token-min-32!!' })),
    ).toThrow(UnauthorizedException);
  });

  it('accepts a matching platform token', () => {
    const guard = new OpsMetricsGuard(makeConfig(TOKEN));
    expect(guard.canActivate(makeContext({ [OPS_METRICS_TOKEN_HEADER]: TOKEN }))).toBe(true);
  });
});
