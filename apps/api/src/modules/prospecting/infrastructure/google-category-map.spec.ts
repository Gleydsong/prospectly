import { googleLanguageCode, mapCategoryToGoogleTextQuery } from './google-category-map';

describe('google-category-map', () => {
  it('maps language codes by country with English fallback', () => {
    expect(googleLanguageCode('BR')).toBe('pt-BR');
    expect(googleLanguageCode('PT')).toBe('pt-PT');
    expect(googleLanguageCode('ES')).toBe('es');
    expect(googleLanguageCode('FR')).toBe('fr');
    expect(googleLanguageCode('DE')).toBe('de');
    expect(googleLanguageCode('IT')).toBe('it');
    expect(googleLanguageCode('GB')).toBe('en');
    expect(googleLanguageCode('XK')).toBe('en');
  });

  it('builds Portuguese query phrasing for BR and PT', () => {
    expect(mapCategoryToGoogleTextQuery('bakery', 'São Paulo', 'SP', 'BR')).toBe(
      'Padaria em São Paulo, SP, Brasil',
    );
    expect(mapCategoryToGoogleTextQuery('bakery', 'Lisboa', 'Lisboa', 'PT')).toBe(
      'Padaria em Lisboa, Lisboa, Portugal',
    );
  });

  it('builds English query phrasing for other European countries', () => {
    expect(mapCategoryToGoogleTextQuery('restaurant', 'Berlin', 'Berlin', 'DE')).toBe(
      'Restaurante in Berlin, Berlin, Alemanha',
    );
    expect(mapCategoryToGoogleTextQuery('hotel', 'Madrid', 'Community of Madrid', 'ES')).toBe(
      'Hotel in Madrid, Community of Madrid, Espanha',
    );
  });
});
