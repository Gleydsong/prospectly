import { BadRequestException, Injectable } from '@nestjs/common';
import { City, State } from 'country-state-city';

import { isProspectingCountryCode, type ProspectingCountryCode } from '../prospecting/domain/search-provider';

export interface GeoRegionOption {
  code: string;
  name: string;
}

export interface GeoCityOption {
  name: string;
}

@Injectable()
export class GeoService {
  listRegions(countryRaw: string): GeoRegionOption[] {
    const country = this.requireCountry(countryRaw);
    return State.getStatesOfCountry(country)
      .map((state) => ({ code: state.isoCode, name: state.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }

  listCities(countryRaw: string, regionRaw: string): GeoCityOption[] {
    const country = this.requireCountry(countryRaw);
    const regionCode = regionRaw?.trim();
    if (!regionCode) {
      throw new BadRequestException('region is required');
    }

    const region = State.getStatesOfCountry(country).find((state) => state.isoCode === regionCode);
    if (!region) {
      throw new BadRequestException('region is invalid for the selected country');
    }

    const cities = City.getCitiesOfState(country, regionCode) ?? [];
    const unique = new Map<string, GeoCityOption>();
    for (const city of cities) {
      const name = city.name.trim();
      if (!name) continue;
      unique.set(name.toLocaleLowerCase('pt'), { name });
    }

    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  }

  private requireCountry(countryRaw: string): ProspectingCountryCode {
    const country = countryRaw?.trim().toUpperCase();
    if (!isProspectingCountryCode(country)) {
      throw new BadRequestException('country must be a supported prospecting country');
    }
    return country;
  }
}
