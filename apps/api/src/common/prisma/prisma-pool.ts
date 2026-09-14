export const PRISMA_API_CONNECTION_LIMIT = 5;
export const PRISMA_WORKER_CONNECTION_LIMIT = 3;
export const PRISMA_POOL_TIMEOUT_SECONDS = 10;

export type PrismaProcessRole = 'api' | 'worker';

export function prismaProcessRole(role = process.env.ROLE): PrismaProcessRole {
  return role === 'worker' ? 'worker' : 'api';
}

export function prismaConnectionLimit(role: PrismaProcessRole): number {
  return role === 'worker' ? PRISMA_WORKER_CONNECTION_LIMIT : PRISMA_API_CONNECTION_LIMIT;
}

export function withPrismaPoolParams(
  url: string,
  options: { connectionLimit: number; poolTimeoutSeconds: number },
): string {
  const question = url.indexOf('?');
  const base = question === -1 ? url : url.slice(0, question);
  const query = question === -1 ? '' : url.slice(question + 1);
  const params = new URLSearchParams(query);
  if (!params.has('connection_limit')) {
    params.set('connection_limit', String(options.connectionLimit));
  }
  if (!params.has('pool_timeout')) {
    params.set('pool_timeout', String(options.poolTimeoutSeconds));
  }
  const serialized = params.toString();
  return serialized ? `${base}?${serialized}` : base;
}
