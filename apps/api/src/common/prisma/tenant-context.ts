import { AsyncLocalStorage } from 'node:async_hooks';

export type TenantStore = {
  organizationId: string | null;
  userId: string | null;
  bypass: boolean;
};

const storage = new AsyncLocalStorage<TenantStore>();
const rlsTransaction = new AsyncLocalStorage<boolean>();

export function getTenantContext(): TenantStore | undefined {
  return storage.getStore();
}

export function isInRlsTransaction(): boolean {
  return rlsTransaction.getStore() === true;
}

export function runInRlsTransaction<T>(fn: () => T): T {
  return rlsTransaction.run(true, fn);
}

export function runWithTenant<T>(
  organizationId: string,
  fn: () => T,
  userId: string | null = null,
): T {
  return storage.run({ organizationId, userId, bypass: false }, fn);
}

export function runWithBypass<T>(fn: () => T): T {
  return storage.run({ organizationId: null, userId: null, bypass: true }, fn);
}
