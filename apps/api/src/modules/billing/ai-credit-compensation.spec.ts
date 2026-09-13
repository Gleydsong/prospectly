import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { shouldRefundAiConsume } from './ai-credit-compensation';

describe('shouldRefundAiConsume', () => {
  it('refunds internal failures so the owner does not pay for work that did not happen', () => {
    expect(shouldRefundAiConsume(new Error('timeout'))).toBe(true);
    expect(shouldRefundAiConsume(new ServiceUnavailableException('queue down'))).toBe(true);
    expect(shouldRefundAiConsume({ code: 'ECONNABORTED' })).toBe(true);
  });

  it('does not refund actor 4xx validation, cancel or entitlement denials', () => {
    expect(shouldRefundAiConsume(new BadRequestException('invalid input'))).toBe(false);
    expect(shouldRefundAiConsume(new ForbiddenException('No credits remaining'))).toBe(false);
  });
});
