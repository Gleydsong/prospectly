import {
  countryDisplayName,
  isBrazilianStateCode,
  isProspectingCountryCode,
  PROSPECTING_COUNTRIES,
  PROSPECTING_COUNTRY_CODES,
} from './search-provider';

describe('prospecting geo domain', () => {
  it('includes Brazil and a broad European ISO list', () => {
    expect(PROSPECTING_COUNTRY_CODES).toContain('BR');
    expect(PROSPECTING_COUNTRY_CODES).toContain('PT');
    expect(PROSPECTING_COUNTRY_CODES).toContain('DE');
    expect(PROSPECTING_COUNTRY_CODES).toContain('ES');
    expect(PROSPECTING_COUNTRY_CODES).toContain('FR');
    expect(PROSPECTING_COUNTRY_CODES).toContain('GB');
    expect(PROSPECTING_COUNTRY_CODES).toContain('XK');
    expect(PROSPECTING_COUNTRIES).toHaveLength(PROSPECTING_COUNTRY_CODES.length);
  });

  it('validates country and Brazilian state codes', () => {
    expect(isProspectingCountryCode('BR')).toBe(true);
    expect(isProspectingCountryCode('PT')).toBe(true);
    expect(isProspectingCountryCode('US')).toBe(false);
    expect(isBrazilianStateCode('SP')).toBe(true);
    expect(isBrazilianStateCode('XX')).toBe(false);
  });

  it('exposes Portuguese display labels for UI/provider queries', () => {
    expect(countryDisplayName('BR')).toBe('Brasil');
    expect(countryDisplayName('PT')).toBe('Portugal');
    expect(countryDisplayName('DE')).toBe('Alemanha');
  });
});
