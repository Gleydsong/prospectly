import { WebsitePresence } from '@prisma/client';

import type { NormalizedBusiness } from './normalized-business';
import { businessDedupeKey, mergeProviderResults } from './merge-search-results';

function business(partial: Partial<NormalizedBusiness> & Pick<NormalizedBusiness, 'externalId' | 'companyName' | 'source'>): NormalizedBusiness {
  return {
    city: 'Curitiba',
    state: 'PR',
    country: 'BR',
    websitePresence: WebsitePresence.NO_WEBSITE_REPORTED,
    ...partial,
  };
}

describe('mergeProviderResults', () => {
  it('merges the same business from OSM and Google by phone and keeps richer fields', () => {
    const osm = business({
      externalId: 'osm:1',
      companyName: 'Clinica Exemplo',
      phone: '(41) 99999-1111',
      source: 'OPENSTREETMAP',
    });
    const google = business({
      externalId: 'google:abc',
      companyName: 'Clínica Exemplo',
      phone: '41999991111',
      website: 'https://exemplo.com',
      websitePresence: WebsitePresence.WEBSITE_FOUND,
      source: 'GOOGLE_PLACES',
    });

    const merged = mergeProviderResults([osm, google]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.phone).toBeTruthy();
    expect(merged[0]?.website).toBe('https://exemplo.com');
    expect(businessDedupeKey(osm)).toBe(businessDedupeKey(google));
  });

  it('keeps distinct businesses without shared phone/name', () => {
    const a = business({ externalId: 'osm:1', companyName: 'Alpha', source: 'OPENSTREETMAP' });
    const b = business({ externalId: 'google:2', companyName: 'Beta', source: 'GOOGLE_PLACES' });
    expect(mergeProviderResults([a, b])).toHaveLength(2);
  });
});
