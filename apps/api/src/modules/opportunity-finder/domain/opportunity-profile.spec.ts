import { buildDeterministicOpportunityProfile, OpportunityProfileSchema } from './opportunity-profile';

describe('opportunity profile', () => {
  it('maps Brazilian service hints to the existing prospecting category catalog', () => {
    expect(buildDeterministicOpportunityProfile('Marketing para clínicas odontológicas').categories)
      .toContain('clinic');
  });

  it('rejects categories invented by model output', () => {
    expect(OpportunityProfileSchema.safeParse({
      service: 'Criação de sites',
      targetCustomer: ['empresas'],
      relevantSignals: ['MISSING_WEBSITE'],
      categories: ['invented_category'],
    }).success).toBe(false);
  });
});
