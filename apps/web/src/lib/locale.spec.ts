import { describe, expect, it } from 'vitest';

import { detectBrowserLocale, toIntlLocale } from './locale';

describe('detectBrowserLocale', () => {
  it('maps Portuguese variants to pt', () => {
    expect(detectBrowserLocale('pt')).toBe('pt');
    expect(detectBrowserLocale('pt-BR')).toBe('pt');
    expect(detectBrowserLocale('pt-PT')).toBe('pt');
  });

  it('maps other languages to en', () => {
    expect(detectBrowserLocale('en')).toBe('en');
    expect(detectBrowserLocale('en-US')).toBe('en');
    expect(detectBrowserLocale('es-ES')).toBe('en');
  });
});

describe('toIntlLocale', () => {
  it('maps app locales to Intl tags', () => {
    expect(toIntlLocale('pt')).toBe('pt-PT');
    expect(toIntlLocale('en')).toBe('en-GB');
  });
});
