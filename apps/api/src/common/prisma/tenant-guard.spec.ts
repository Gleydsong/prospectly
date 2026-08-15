import { assertTenantOperation, TenantScopeError } from './tenant-guard';
import { runWithBypass, runWithTenant } from './tenant-context';

describe('assertTenantOperation', () => {
  it('skips when no tenant store is active', () => {
    expect(() =>
      assertTenantOperation('Lead', 'findFirst', { where: { id: 'lead-1' } }),
    ).not.toThrow();
  });

  it('skips under bypass', () => {
    runWithBypass(() => {
      expect(() =>
        assertTenantOperation('Lead', 'findFirst', { where: { id: 'lead-1' } }),
      ).not.toThrow();
    });
  });

  it('throws when tenant context is missing an organization id', () => {
    runWithTenant('', () => {
      expect(() =>
        assertTenantOperation('Lead', 'findFirst', { where: { id: 'lead-1' } }),
      ).toThrow(TenantScopeError);
    });
  });

  it('injects organizationId when the where clause omits it', () => {
    const args = { where: { id: 'lead-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('Lead', 'findFirst', args);
    });
    expect(args.where).toEqual({ id: 'lead-1', organizationId: 'org-1' });
  });

  it('allows an explicit matching organizationId', () => {
    const args = { where: { id: 'lead-1', organizationId: 'org-1' } };
    runWithTenant('org-1', () => {
      expect(() => assertTenantOperation('Lead', 'findFirst', args)).not.toThrow();
    });
  });

  it('throws when the where organizationId does not match the tenant', () => {
    runWithTenant('org-1', () => {
      expect(() =>
        assertTenantOperation('Lead', 'findFirst', {
          where: { id: 'lead-1', organizationId: 'org-2' },
        }),
      ).toThrow(TenantScopeError);
    });
  });

  it('requires data.organizationId on create', () => {
    runWithTenant('org-1', () => {
      expect(() =>
        assertTenantOperation('Lead', 'create', { data: { companyName: 'Acme' } }),
      ).toThrow(TenantScopeError);
      expect(() =>
        assertTenantOperation('Lead', 'create', {
          data: { companyName: 'Acme', organizationId: 'org-1' },
        }),
      ).not.toThrow();
    });
  });
});
