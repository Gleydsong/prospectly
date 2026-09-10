import {
  PRISMA_API_CONNECTION_LIMIT,
  PRISMA_POOL_TIMEOUT_SECONDS,
  PRISMA_WORKER_CONNECTION_LIMIT,
  prismaConnectionLimit,
  prismaProcessRole,
  withPrismaPoolParams,
} from './prisma-pool';

describe('prisma pool params', () => {
  it('caps the API pool below the worker-unbounded default and documents timeout', () => {
    const url = withPrismaPoolParams(
      'postgresql://prospectly:prospectly@localhost:5432/prospectly?schema=public',
      {
        connectionLimit: prismaConnectionLimit('api'),
        poolTimeoutSeconds: PRISMA_POOL_TIMEOUT_SECONDS,
      },
    );

    expect(url).toContain('connection_limit=5');
    expect(url).toContain('pool_timeout=10');
    expect(url).toContain('schema=public');
    expect(PRISMA_API_CONNECTION_LIMIT).toBe(5);
  });

  it('gives the worker a smaller pool than the API so outbox cannot starve HTTP', () => {
    expect(prismaConnectionLimit('worker')).toBe(PRISMA_WORKER_CONNECTION_LIMIT);
    expect(PRISMA_WORKER_CONNECTION_LIMIT).toBeLessThan(PRISMA_API_CONNECTION_LIMIT);

    const url = withPrismaPoolParams('postgresql://u:p@localhost:5432/prospectly', {
      connectionLimit: prismaConnectionLimit('worker'),
      poolTimeoutSeconds: PRISMA_POOL_TIMEOUT_SECONDS,
    });
    expect(url).toContain('connection_limit=3');
  });

  it('maps ROLE=worker to the worker pool and everything else to the API pool', () => {
    expect(prismaProcessRole('worker')).toBe('worker');
    expect(prismaProcessRole('api')).toBe('api');
    expect(prismaProcessRole(undefined)).toBe('api');
  });

  it('does not overwrite connection_limit or pool_timeout already in the URL', () => {
    const url = withPrismaPoolParams(
      'postgresql://u:p@localhost:5432/prospectly?connection_limit=2&pool_timeout=4',
      { connectionLimit: 99, poolTimeoutSeconds: 99 },
    );
    expect(url).toContain('connection_limit=2');
    expect(url).toContain('pool_timeout=4');
    expect(url).not.toContain('connection_limit=99');
  });
});
