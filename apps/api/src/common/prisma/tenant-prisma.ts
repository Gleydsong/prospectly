import { Prisma, PrismaClient } from '@prisma/client';

import {
  getTenantContext,
  isInRlsTransaction,
  runInRlsTransaction,
  type TenantStore,
} from './tenant-context';
import { assertTenantOperation } from './tenant-guard';

const RAW_OPERATIONS = new Set([
  '$executeRaw',
  '$executeRawUnsafe',
  '$queryRaw',
  '$queryRawUnsafe',
]);

export async function applyTenantGuc(
  tx: { $executeRaw: PrismaClient['$executeRaw'] },
  ctx: TenantStore,
): Promise<void> {
  const orgId = ctx.bypass ? '' : (ctx.organizationId ?? '');
  const userId = ctx.userId ?? '';
  const bypass = ctx.bypass ? 'on' : '';
  await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true), set_config('app.current_user_id', ${userId}, true), set_config('app.rls_bypass', ${bypass}, true)`;
}

export function extendPrismaClient<T extends PrismaClient>(client: T): T {
  const extended = client.$extends({
    name: 'tenant-rls',
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (RAW_OPERATIONS.has(operation)) {
          return query(args);
        }
        if (model) {
          assertTenantOperation(model, operation, args);
        }

        if (isInRlsTransaction()) {
          return query(args);
        }

        const ctx = getTenantContext();
        if (!ctx) {
          return query(args);
        }

        return runInRlsTransaction(() =>
          client.$transaction(async (tx) => {
            await applyTenantGuc(tx, ctx);
            return query(args);
          }),
        );
      },
    },
  });

  const originalTransaction = extended.$transaction.bind(extended) as PrismaClient['$transaction'];

  const wrappedTransaction = ((
    arg: Parameters<PrismaClient['$transaction']>[0],
    options?: Parameters<PrismaClient['$transaction']>[1],
  ) => {
    const ctx = getTenantContext();

    if (typeof arg === 'function') {
      const fn = arg as (tx: Prisma.TransactionClient) => Promise<unknown>;
      if (isInRlsTransaction() || !ctx) {
        return originalTransaction(fn as never, options);
      }
      return runInRlsTransaction(() =>
        originalTransaction(async (tx) => {
          await applyTenantGuc(tx, ctx);
          return fn(tx);
        }, options),
      );
    }

    return originalTransaction(arg as never, options);
  }) as PrismaClient['$transaction'];

  Object.defineProperty(extended, '$transaction', {
    value: wrappedTransaction,
    writable: true,
    configurable: true,
  });

  return extended as unknown as T;
}
