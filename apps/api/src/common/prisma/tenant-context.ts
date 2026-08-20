import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  organizationId: string | null;
  userId: string | null;
  bypass: boolean;
};

const storage = new AsyncLocalStorage<TenantStore>();
const rlsTransaction = new AsyncLocalStorage<boolean>();

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return Boolean(value) && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * PrismaPromises are lazy thenables. If a helper returns one and the caller
 * awaits it after leaving AsyncLocalStorage.run, `$allOperations` sees no tenant
 * context and skips transaction-local GUCs. Keep the store alive until settle.
 */
function bindStoreToResult<T>(result: T): T {
  if (!isThenable(result)) return result;
  return (async () => await result)() as T;
}

export function getTenantContext(): TenantStore | undefined {
  return storage.getStore();
}

export function isInRlsTransaction(): boolean {
  return rlsTransaction.getStore() === true;
}

export function runInRlsTransaction<T>(fn: () => T): T {
  return rlsTransaction.run(true, () => bindStoreToResult(fn()));
}

export function runWithTenant<T>(
  organizationId: string,
  fn: () => T,
  userId: string | null = null,
): T {
  return storage.run({ organizationId, userId, bypass: false }, () => bindStoreToResult(fn()));
}

export function runWithBypass<T>(fn: () => T): T {
  return storage.run({ organizationId: null, userId: null, bypass: true }, () => bindStoreToResult(fn()));
}
