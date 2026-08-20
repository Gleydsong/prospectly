import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';

export const RATE_LIMITED_CODE = 'RATE_LIMITED';

/**
 * Replaces the default `ThrottlerException: Too Many Requests` payload with a
 * client-facing message plus a stable code the frontend can localize.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  public async throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many attempts. Wait a moment and try again.',
        error: 'Too Many Requests',
        code: RATE_LIMITED_CODE,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
