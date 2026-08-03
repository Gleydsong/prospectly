import {
  buildOpportunitySignal,
  type OpportunitySignalInput,
} from '@prospectly/shared-types';

describe('buildOpportunitySignal', () => {
  const base: OpportunitySignalInput = {
    websitePresence: 'NO_WEBSITE_REPORTED',
    phone: '+5511999999999',
    rating: 4.6,
    reviewCount: 42,
    inCrm: false,
  };

  it('marks high opportunity without claiming business has no website', () => {
    const signal = buildOpportunitySignal(base);
    expect(signal.level).toBe('HIGH');
    expect(signal.tags).toEqual(
      expect.arrayContaining(['HIGH_POTENTIAL', 'SITE_NOT_REPORTED', 'HAS_CONTACT', 'NEW']),
    );
    expect(signal.reasons).toContain('website_not_reported_by_source');
  });

  it('preserves NO_WEBSITE_REPORTED semantics in reasons', () => {
    const signal = buildOpportunitySignal({
      ...base,
      websitePresence: 'NO_WEBSITE_REPORTED',
    });
    expect(signal.reasons).toContain('website_not_reported_by_source');
    expect(JSON.stringify(signal)).not.toMatch(/sem site|no website exists|empresa sem site/i);
  });

  it('lowers score when already in CRM and website was reported', () => {
    const signal = buildOpportunitySignal({
      websitePresence: 'WEBSITE_FOUND',
      phone: null,
      inCrm: true,
    });
    expect(signal.level).toBe('LOW');
    expect(signal.tags).toContain('IN_CRM');
    expect(signal.reasons).toContain('already_in_crm');
  });
});
