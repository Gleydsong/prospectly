import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';

describe('clientsMap plural translations', () => {
  it('correctly pluralizes map count in Portuguese (pt)', async () => {
    await i18n.changeLanguage('pt');
    expect(i18n.t('clientsMap.count', { count: 0 })).toBe('0 clientes com localização nesta área');
    expect(i18n.t('clientsMap.count', { count: 1 })).toBe('1 cliente com localização nesta área');
    expect(i18n.t('clientsMap.count', { count: 2 })).toBe('2 clientes com localização nesta área');
    expect(i18n.t('clientsMap.count', { count: 30 })).toBe(
      '30 clientes com localização nesta área',
    );
  });

  it('correctly pluralizes map count in English (en)', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('clientsMap.count', { count: 0 })).toBe('0 clients with a location in this area');
    expect(i18n.t('clientsMap.count', { count: 1 })).toBe('1 client with a location in this area');
    expect(i18n.t('clientsMap.count', { count: 2 })).toBe('2 clients with a location in this area');
    expect(i18n.t('clientsMap.count', { count: 30 })).toBe(
      '30 clients with a location in this area',
    );
    await i18n.changeLanguage('pt');
  });
});
