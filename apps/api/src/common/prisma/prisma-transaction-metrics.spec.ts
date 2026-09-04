import { ForbiddenException } from '@nestjs/common';

import {
  instrumentPrismaTransaction,
  isExpectedTransactionOutcome,
} from './prisma-transaction-metrics';

describe('prisma transaction metrics', () => {
  it('ignores HTTP exceptions and unique conflicts', () => {
    expect(isExpectedTransactionOutcome(new ForbiddenException('no credits'))).toBe(true);
    expect(isExpectedTransactionOutcome({ code: 'P2002' })).toBe(true);
    expect(isExpectedTransactionOutcome(new Error('connection reset'))).toBe(false);
  });

  it('records unexpected $transaction failures and rethrows', async () => {
    const recorded: number[] = [];
    const client = {
      $transaction: jest.fn().mockRejectedValue(new Error('P2028')),
    };
    instrumentPrismaTransaction(client, () => recorded.push(1));

    await expect(client.$transaction(async () => undefined)).rejects.toThrow('P2028');
    expect(recorded).toEqual([1]);
  });

  it('does not record unique conflicts that callers treat as idempotent', async () => {
    const recorded: number[] = [];
    const client = {
      $transaction: jest.fn().mockRejectedValue({ code: 'P2002' }),
    };
    instrumentPrismaTransaction(client, () => recorded.push(1));

    await expect(client.$transaction(async () => undefined)).rejects.toEqual({ code: 'P2002' });
    expect(recorded).toEqual([]);
  });
});
