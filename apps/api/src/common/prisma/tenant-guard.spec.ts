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
      expect(() => assertTenantOperation('Lead', 'findFirst', { where: { id: 'lead-1' } })).toThrow(
        TenantScopeError,
      );
    });
  });

  it('injects organizationId when the where clause omits it', () => {
    const args = { where: { id: 'lead-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('Lead', 'findFirst', args);
    });
    expect(args.where).toEqual({ id: 'lead-1', organizationId: 'org-1' });
  });

  it('applies tenant scope to google connections', () => {
    const args = { where: { id: 'conn-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('GoogleConnection', 'findFirst', args);
    });
    expect(args.where).toEqual({ id: 'conn-1', organizationId: 'org-1' });
  });

  it('applies tenant scope to synced communications', () => {
    const args = { where: { id: 'sc-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('SyncedCommunication', 'findFirst', args);
    });
    expect(args.where).toEqual({ id: 'sc-1', organizationId: 'org-1' });
  });

  it('applies tenant scope to organization flags', () => {
    const args = { where: { key: 'saved_report' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('OrganizationFlag', 'findFirst', args);
    });
    expect(args.where).toEqual({ key: 'saved_report', organizationId: 'org-1' });
  });

  it('applies tenant scope to saved reports', () => {
    const args = { where: { id: 'rep-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('SavedReport', 'findFirst', args);
    });
    expect(args.where).toEqual({ id: 'rep-1', organizationId: 'org-1' });
  });

  it('applies tenant scope to monthly checkout attempts', () => {
    const args = { where: { id: 'attempt-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('MonthlyCheckoutAttempt', 'updateMany', args);
    });
    expect(args.where).toEqual({ id: 'attempt-1', organizationId: 'org-1' });
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

  it('applies tenant scope to MCP connections', () => {
    const args = { where: { id: 'mcp-conn-1' } };
    runWithTenant('org-1', () => {
      assertTenantOperation('McpConnection', 'findFirst', args);
    });
    expect(args.where).toEqual({ id: 'mcp-conn-1', organizationId: 'org-1' });
  });

  it('does not inject organizationId on OauthClient lookups', () => {
    const args = { where: { id: 'client-1' } };
    runWithTenant('org-1', () => {
      expect(() => assertTenantOperation('OauthClient', 'findFirst', args)).not.toThrow();
    });
    expect(args.where).toEqual({ id: 'client-1' });
  });

  it('requires tenant context for LeadWebsite child rows', () => {
    runWithTenant('', () => {
      expect(() =>
        assertTenantOperation('LeadWebsite', 'create', {
          data: { url: 'https://loja.example', urlNormalized: 'https://loja.example' },
        }),
      ).toThrow(TenantScopeError);
    });
    runWithTenant('org-1', () => {
      expect(() =>
        assertTenantOperation('LeadWebsite', 'create', {
          data: { url: 'https://loja.example', urlNormalized: 'https://loja.example' },
        }),
      ).not.toThrow();
    });
  });
});
