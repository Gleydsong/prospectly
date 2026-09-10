import { resolveOpportunityNiche, buildOpportunitySearchPhrases } from './niche-variants';

describe('niche variants', () => {
  it.each([
    ['clinicas', 'clinic'],
    ['clínica médica', 'clinic'],
    ['consultório odontológico', 'clinic'],
    ['fisioterapia', 'clinic'],
    ['pizzaria', 'restaurant'],
    ['açaíteria', 'cafe'],
    ['boteco', 'bar'],
    ['drogaria', 'pharmacy'],
    ['santa casa', 'hospital'],
    ['minimercado', 'supermarket'],
    ['confeitaria', 'bakery'],
    ['casa de carnes', 'butcher'],
    ['loja de roupa feminina', 'clothes'],
    ['salão', 'hairdresser'],
    ['móveis planejados', 'carpenter'],
    ['eletricista residencial', 'electrician'],
    ['escritório de contabilidade', 'accountant'],
    ['advogado trabalhista', 'lawyer'],
    ['hotel fazenda', 'hotel'],
    ['albergue', 'hostel'],
    ['pousada', 'guest_house'],
  ] as const)('maps "%s" to %s', (niche, category) => {
    expect(resolveOpportunityNiche(niche)).toEqual({ status: 'RESOLVED', category });
  });

  it('prefers the longest phrase when beauty clinics overlap health clinics', () => {
    expect(resolveOpportunityNiche('clínica de estética')).toEqual({
      status: 'RESOLVED',
      category: 'hairdresser',
    });
  });

  it('keeps mixed niches ambiguous instead of guessing', () => {
    expect(resolveOpportunityNiche('roupas e restaurantes')).toEqual({
      status: 'AMBIGUOUS',
      categories: ['restaurant', 'clothes'],
    });
  });

  it('builds Google search variants from the typed niche, not only the catalog label', () => {
    expect(buildOpportunitySearchPhrases('clinicas', 'clinic')).toEqual(
      expect.arrayContaining(['clinicas', 'Clínica']),
    );
    expect(buildOpportunitySearchPhrases('clinicas', 'clinic')).toHaveLength(4);
    expect(buildOpportunitySearchPhrases('Roupas de atacados', 'clothes')[0]).toBe('Roupas de atacados');
  });
});
