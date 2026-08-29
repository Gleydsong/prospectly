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

type InteractiveTransaction = <R>(
  fn: (tx: Prisma.TransactionClient) => Promise<R>,
  options?: Parameters<PrismaClient['$transaction']>[1],
) => Promise<R>;

type TransactionModelClient = Record<
  string,
  Record<string, (operationArgs: unknown) => Promise<unknown>>
>;

function tenantGucValues(ctx: TenantStore) {
  return {
    orgId: ctx.bypass ? '' : (ctx.organizationId ?? ''),
    userId: ctx.userId ?? '',
    bypass: ctx.bypass ? 'on' : '',
  };
}

export function modelDelegateName(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

export async function applyTenantGuc(
  tx: { $executeRaw: PrismaClient['$executeRaw'] },
  ctx: TenantStore,
): Promise<void> {
  const { orgId, userId, bypass } = tenantGucValues(ctx);
  await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true), set_config('app.current_user_id', ${userId}, true), set_config('app.rls_bypass', ${bypass}, true)`;
}

export function runOnTransactionClient(
  tx: Prisma.TransactionClient,
  model: string,
  operation: string,
  args: unknown,
): Promise<unknown> {
  const table = (tx as unknown as TransactionModelClient)[modelDelegateName(model)];
  const fn = table?.[operation];
  if (typeof fn !== 'function') {
    throw new Error(`Unsupported tenant operation ${model}.${operation}`);
  }
  return fn.call(table, args);
}

export function runRawOnTransactionClient(
  tx: Prisma.TransactionClient,
  operation: string,
  args: unknown,
): Promise<unknown> {
  const client = tx as unknown as Record<
    string,
    ((...rawArgs: unknown[]) => Promise<unknown>) | undefined
  >;
  const fn = client[operation];
  if (typeof fn !== 'function') {
    throw new Error(`Unsupported tenant raw operation ${operation}`);
  }
  if (Array.isArray(args)) {
    return fn.apply(tx, args);
  }
  return fn.call(tx, args);
}

export function extendPrismaClient<T extends PrismaClient>(client: T): T {
  const interactive: { run: InteractiveTransaction | null } = { run: null };

  const extended = client.$extends({
    name: 'tenant-rls',
    query: {
      async $allOperations({ model, operation, args, query }) {
        const isRaw = RAW_OPERATIONS.has(operation);
        if (!isRaw && model) {
          assertTenantOperation(model, operation, args);
        }

        if (isInRlsTransaction()) {
          return query(args);
        }

        const ctx = getTenantContext();
        if (!ctx) {
          return query(args);
        }

        // `query(args)` is bound to the caller client, not to an interactive
        // transaction connection. Re-issuing the operation on `tx` keeps
        // transaction-local GUCs and the protected query on the same connection.
        return runInRlsTransaction(() => {
          if (!interactive.run) {
            throw new Error('Tenant Prisma client is not ready');
          }
          return interactive.run(async (tx) => {
            await applyTenantGuc(tx, ctx);
            if (isRaw) {
              return runRawOnTransactionClient(tx, operation, args);
            }
            if (!model) {
              throw new Error(`Tenant-scoped query is missing a Prisma model for ${operation}`);
            }
            return runOnTransactionClient(tx, model, operation, args);
          });
        });
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

  interactive.run = wrappedTransaction as InteractiveTransaction;

  return extended as unknown as T;
}
