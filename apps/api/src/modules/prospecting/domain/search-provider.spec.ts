import {
  countryDisplayName,
  formatLocalizedPlaceQuery,
  isBrazilianStateCode,
  isProspectingCountryCode,
  PROSPECTING_COUNTRIES,
  PROSPECTING_COUNTRY_CODES,
} from './search-provider';

describe('prospecting geo domain', () => {
  it('is Brazil-only', () => {
    expect(PROSPECTING_COUNTRY_CODES).toEqual(['BR']);
    expect(PROSPECTING_COUNTRIES).toEqual([{ value: 'BR', label: 'Brasil' }]);
  });

  it('validates country and Brazilian state codes', () => {
    expect(isProspectingCountryCode('BR')).toBe(true);
    expect(isProspectingCountryCode('PT')).toBe(false);
    expect(isProspectingCountryCode('US')).toBe(false);
    expect(isBrazilianStateCode('SP')).toBe(true);
    expect(isBrazilianStateCode('XX')).toBe(false);
  });

  it('exposes Portuguese display labels for UI/provider queries', () => {
    expect(countryDisplayName('BR')).toBe('Brasil');
  });

  it('formats a free-text niche as a localized Places query', () => {
    expect(formatLocalizedPlaceQuery('clinicas', 'Jaboatão dos Guararapes', 'PE', 'BR')).toBe(
      'clinicas em Jaboatão dos Guararapes, PE, Brasil',
    );
  });
});
