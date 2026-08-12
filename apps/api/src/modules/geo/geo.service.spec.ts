import { BadRequestException } from '@nestjs/common';

import { GeoService } from './geo.service';

describe('GeoService', () => {
  const service = new GeoService();

  it('lists Brazilian states with UF codes', () => {
    const regions = service.listRegions('br');
    expect(regions.some((region) => region.code === 'SP' && region.name === 'São Paulo')).toBe(true);
    expect(regions.some((region) => region.code === 'RJ')).toBe(true);
  });

  it('lists cities for a Brazilian UF', () => {
    const cities = service.listCities('BR', 'SP');
    expect(cities.some((city) => city.name === 'São Paulo')).toBe(true);
    expect(cities.every((city) => typeof city.name === 'string' && city.name.length > 0)).toBe(true);
  });

  it('rejects unsupported countries', () => {
    expect(() => service.listRegions('US')).toThrow(BadRequestException);
    expect(() => service.listCities('US', 'NY')).toThrow(BadRequestException);
    expect(() => service.listRegions('PT')).toThrow(BadRequestException);
    expect(() => service.listCities('PT', '11')).toThrow(BadRequestException);
  });

  it('rejects invalid region for a valid country', () => {
    expect(() => service.listCities('BR', 'XX')).toThrow(BadRequestException);
    expect(() => service.listCities('BR', '')).toThrow(BadRequestException);
  });
});
