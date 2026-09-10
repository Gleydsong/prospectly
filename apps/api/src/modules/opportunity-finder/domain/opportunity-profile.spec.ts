import type { ProspectingCategory } from '@prospectly/shared-types';

import {
  buildDeterministicOpportunityProfile,
  OpportunityProfileSchema,
  resolveOpportunityNiche,
} from './opportunity-profile';

const NICHE_CASES: Array<[string, ProspectingCategory]> = [
  ['churrascarias', 'restaurant'],
  ['cafeterias', 'cafe'],
  ['bares', 'bar'],
  ['drogarias', 'pharmacy'],
  ['hospitais', 'hospital'],
  ['clínicas odontológicas', 'clinic'],
  ['clinicas', 'clinic'],
  ['supermercados', 'supermarket'],
  ['panificadoras', 'bakery'],
  ['açougues', 'butcher'],
  ['Roupas de atacados', 'clothes'],
  ['barbearias', 'hairdresser'],
  ['marcenarias', 'carpenter'],
  ['instalações elétricas', 'electrician'],
  ['escritórios contábeis', 'accountant'],
  ['escritórios jurídicos', 'lawyer'],
  ['hotéis', 'hotel'],
  ['albergues', 'hostel'],
  ['pousadas', 'guest_house'],
];

describe('opportunity profile', () => {
  it.each(NICHE_CASES)('maps "%s" exclusively to %s', (niche, category) => {
    expect(resolveOpportunityNiche(niche)).toEqual({ status: 'RESOLVED', category });
  });

  it('keeps beauty separate from clothing and bar', () => {
    expect(resolveOpportunityNiche('salões de beleza e barbearias')).toEqual({
      status: 'RESOLVED',
      category: 'hairdresser',
    });
  });

  it('rejects unknown and ambiguous niches instead of using generic categories', () => {
    expect(resolveOpportunityNiche('consultoria de processos')).toEqual({ status: 'NOT_IDENTIFIED' });
    expect(resolveOpportunityNiche('roupas e restaurantes')).toEqual({
      status: 'AMBIGUOUS',
      categories: ['restaurant', 'clothes'],
    });
  });

  it('builds a locked deterministic profile', () => {
    expect(buildDeterministicOpportunityProfile('Criação de sites', 'Roupas no atacado', 'clothes'))
      .toMatchObject({
        service: 'Criação de sites',
        niche: 'Roupas no atacado',
        targetCustomer: ['Roupas no atacado'],
        categories: ['clothes'],
      });
  });

  it('rejects categories invented by model output', () => {
    expect(OpportunityProfileSchema.safeParse({
      service: 'Criação de sites',
      niche: 'Clínicas',
      targetCustomer: ['empresas'],
      relevantSignals: ['MISSING_WEBSITE'],
      categories: ['invented_category'],
    }).success).toBe(false);
  });
});
