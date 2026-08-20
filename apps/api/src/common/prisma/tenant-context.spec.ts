import { getTenantContext, runWithBypass, runWithTenant } from './tenant-context';

describe('tenant AsyncLocalStorage helpers', () => {
  it('keeps tenant context until a lazy Prisma-like thenable settles', async () => {
    let seen: string | null | undefined = 'unset';
    const lazy = {
      then(resolve: (value: string) => void) {
        seen = getTenantContext()?.organizationId ?? null;
        resolve('ok');
      },
    };

    await expect(runWithTenant('org-1', () => lazy as Promise<string>, 'user-1')).resolves.toBe(
      'ok',
    );
    expect(seen).toBe('org-1');
  });

  it('keeps bypass context until a lazy thenable settles', async () => {
    let bypass: boolean | undefined;
    const lazy = {
      then(resolve: (value: string) => void) {
        bypass = getTenantContext()?.bypass;
        resolve('ok');
      },
    };

    await expect(runWithBypass(() => lazy as Promise<string>)).resolves.toBe('ok');
    expect(bypass).toBe(true);
  });

  it('returns synchronous values without wrapping', () => {
    expect(runWithTenant('org-1', () => getTenantContext()?.organizationId)).toBe('org-1');
  });
});
