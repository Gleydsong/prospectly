import { ServiceUnavailableException } from '@nestjs/common';

import {
  REPORTS_QUERY_TIMEOUT_CODE,
  isReportsOverloadError,
  reportsUnavailable,
} from './reports-overload';

describe('reports overload mapping', () => {
  it('treats Prisma P2028 and P2024 as recoverable Relatórios overload', () => {
    expect(isReportsOverloadError({ code: 'P2028' })).toBe(true);
    expect(isReportsOverloadError({ code: 'P2024' })).toBe(true);
    expect(isReportsOverloadError(new Error('canceling statement due to statement timeout'))).toBe(
      true,
    );
    expect(isReportsOverloadError(new Error('connection reset'))).toBe(false);
  });

  it('builds a 503 that tells the viewer to try again and does not look like a 500', () => {
    const error = reportsUnavailable();
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getStatus()).toBe(503);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        code: REPORTS_QUERY_TIMEOUT_CODE,
        message: 'Relatórios indisponível. Tente de novo.',
      }),
    );
  });
});
