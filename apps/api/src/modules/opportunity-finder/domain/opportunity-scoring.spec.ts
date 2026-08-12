import type { OpportunityCompany, OpportunityProfile, WebsiteAnalysisResult } from '@prospectly/shared-types';

import { buildOpportunitySignals, scoreOpportunity } from './opportunity-scoring';

const company: OpportunityCompany = {
  externalId: 'osm:1',
  companyName: 'Clínica Exemplo',
  category: 'clinic',
  city: 'Curitiba',
  state: 'PR',
  country: 'BR',
  phone: '+5541999999999',
  rating: 4.8,
  reviewCount: 120,
  source: 'OPENSTREETMAP',
  websitePresence: 'NO_WEBSITE_REPORTED',
};

const profile: OpportunityProfile = {
  service: 'Criação de sites para clínicas',
  targetCustomer: ['clínicas'],
  categories: ['clinic'],
  relevantSignals: ['MISSING_WEBSITE', 'HIGH_RATING', 'CONTACT_AVAILABLE'],
};

describe('opportunity scoring', () => {
  it('is deterministic for the same evidence and keeps score independent from AI', () => {
    const signals = buildOpportunitySignals(company, null);
    expect(scoreOpportunity(company, profile, signals)).toEqual(
      scoreOpportunity(company, profile, signals),
    );
    expect(scoreOpportunity(company, profile, signals).breakdown.version).toBe('opportunity-score-v1');
  });

  it('distinguishes unknown evidence from a confirmed negative signal', () => {
    const withoutAnalysis = buildOpportunitySignals(company, null);
    expect(withoutAnalysis.find((signal) => signal.type === 'MISSING_HTTPS')?.value).toBe('UNKNOWN');
    expect(withoutAnalysis.find((signal) => signal.type === 'MISSING_WEBSITE')).toMatchObject({
      value: 'TRUE',
      kind: 'INFERENCE',
    });

    const analysis = {
      url: 'http://example.com', accessible: true, https: false, hasViewport: false,
      hasContactForm: false, hasWhatsapp: false, hasBooking: false, responseTimeMs: 3_500, issues: [],
    } satisfies WebsiteAnalysisResult;
    const verified = buildOpportunitySignals({ ...company, website: analysis.url, websitePresence: 'WEBSITE_FOUND' }, analysis);
    expect(verified.find((signal) => signal.type === 'MISSING_HTTPS')?.value).toBe('TRUE');
    expect(scoreOpportunity(company, profile, verified).completeness).toBeGreaterThan(
      scoreOpportunity(company, profile, withoutAnalysis).completeness,
    );
  });
});
