import { HttpException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/** Business outcomes that abort a transaction without meaning the database failed. */
export function isExpectedTransactionOutcome(error: unknown): boolean {
  if (error instanceof HttpException) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export function instrumentPrismaTransaction(
  client: Pick<PrismaClient, '$transaction'>,
  onUnexpectedFailure: () => void,
): void {
  const original = client.$transaction.bind(client) as PrismaClient['$transaction'];
  const instrumented = ((
    arg: Parameters<PrismaClient['$transaction']>[0],
    options?: Parameters<PrismaClient['$transaction']>[1],
  ) =>
    Promise.resolve(original(arg as never, options)).catch((error: unknown) => {
      if (!isExpectedTransactionOutcome(error)) {
        onUnexpectedFailure();
      }
      throw error;
    })) as PrismaClient['$transaction'];

  Object.defineProperty(client, '$transaction', {
    value: instrumented,
    writable: true,
    configurable: true,
  });
}
