import { HttpException, HttpStatus } from '@nestjs/common';

import { RATE_LIMITED_CODE, RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  const makeGuard = () =>
    new RateLimitGuard({ throttlers: [{ ttl: 60_000, limit: 5 }] }, { increment: jest.fn() } as never, {
      getAllAndOverride: jest.fn(),
    } as never);

  it('throws a client-facing payload with a stable code instead of ThrottlerException', async () => {
    const guard = makeGuard();

    await expect(
      guard.throwThrottlingException({} as never, {
        limit: 5,
        ttl: 60_000,
        key: 'key',
        tracker: '127.0.0.1',
        totalHits: 6,
        timeToExpire: 42,
        isBlocked: true,
        timeToBlockExpire: 42,
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      response: {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: RATE_LIMITED_CODE,
      },
    });
  });

  it('does not leak the exception class name in the message', async () => {
    const guard = makeGuard();

    const error = await guard
      .throwThrottlingException({} as never, {
        limit: 5,
        ttl: 60_000,
        key: 'key',
        tracker: '127.0.0.1',
        totalHits: 6,
        timeToExpire: 42,
        isBlocked: true,
        timeToBlockExpire: 42,
      })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(HttpException);
    const body = (error as HttpException).getResponse() as { message: string };
    expect(body.message).not.toContain('ThrottlerException');
  });
});
