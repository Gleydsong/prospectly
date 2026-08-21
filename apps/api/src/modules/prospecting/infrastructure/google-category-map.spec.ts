import { googleLanguageCode, mapCategoryToGoogleTextQuery, resolveGooglePlaceCategory } from './google-category-map';

describe('google-category-map', () => {
  it('maps language code for Brazil', () => {
    expect(googleLanguageCode('BR')).toBe('pt-BR');
  });

  it('builds Portuguese query phrasing for BR', () => {
    expect(mapCategoryToGoogleTextQuery('bakery', 'São Paulo', 'SP', 'BR')).toBe(
      'Padaria em São Paulo, SP, Brasil',
    );
  });

  it('maps Google place types to the Prospectly category, not the searched niche', () => {
    expect(resolveGooglePlaceCategory({ primaryType: 'restaurant', types: ['cafe'] }, 'cafe')).toBe(
      'restaurant',
    );
    expect(resolveGooglePlaceCategory({ types: ['coffee_shop'] }, 'bakery')).toBe('cafe');
    expect(resolveGooglePlaceCategory({}, 'cafe')).toBe('cafe');
  });
});
