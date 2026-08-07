import { googleLanguageCode, mapCategoryToGoogleTextQuery } from './google-category-map';

describe('google-category-map', () => {
  it('maps language code for Brazil', () => {
    expect(googleLanguageCode('BR')).toBe('pt-BR');
  });

  it('builds Portuguese query phrasing for BR', () => {
    expect(mapCategoryToGoogleTextQuery('bakery', 'São Paulo', 'SP', 'BR')).toBe(
      'Padaria em São Paulo, SP, Brasil',
    );
  });
});
