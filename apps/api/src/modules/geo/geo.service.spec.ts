import { BadRequestException } from '@nestjs/common';

import { GeoService } from './geo.service';

describe('GeoService', () => {
  const service = new GeoService();

  it('lists Brazilian states with UF codes', () => {
    const regions = service.listRegions('br');
    expect(regions.some((region) => region.code === 'SP' && region.name === 'São Paulo')).toBe(true);
    expect(regions.some((region) => region.code === 'RJ')).toBe(true);
  });

  it('lists Portuguese districts/regions', () => {
    const regions = service.listRegions('PT');
    expect(regions.length).toBeGreaterThan(5);
    expect(regions.some((region) => region.name === 'Lisbon')).toBe(true);
  });

  it('lists cities for a Brazilian UF', () => {
    const cities = service.listCities('BR', 'SP');
    expect(cities.some((city) => city.name === 'São Paulo')).toBe(true);
    expect(cities.every((city) => typeof city.name === 'string' && city.name.length > 0)).toBe(true);
  });

  it('lists cities for a Portuguese region code', () => {
    const lisbon = service.listRegions('PT').find((region) => region.name === 'Lisbon');
    expect(lisbon).toBeDefined();
    const cities = service.listCities('PT', lisbon!.code);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.some((city) => /lisbon|lisboa/i.test(city.name))).toBe(true);
  });

  it('rejects unsupported countries', () => {
    expect(() => service.listRegions('US')).toThrow(BadRequestException);
    expect(() => service.listCities('US', 'NY')).toThrow(BadRequestException);
  });

  it('rejects invalid region for a valid country', () => {
    expect(() => service.listCities('BR', 'XX')).toThrow(BadRequestException);
    expect(() => service.listCities('PT', '')).toThrow(BadRequestException);
  });
});
