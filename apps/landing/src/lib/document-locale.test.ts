import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  HOME_LANGUAGE_ALTERNATES,
  absoluteHomeLanguageAlternates,
  sitemapHomeEntries,
} from './document-locale';

describe('home hreflang', () => {
  it('pairs the live Portuguese and English homes', () => {
    assert.deepEqual(HOME_LANGUAGE_ALTERNATES, { 'pt-BR': '/', en: '/en' });
    assert.deepEqual(absoluteHomeLanguageAlternates('https://prospectlyonboard.com'), {
      'pt-BR': 'https://prospectlyonboard.com/',
      en: 'https://prospectlyonboard.com/en',
    });
  });
});

describe('sitemapHomeEntries', () => {
  it('lists / and /en with matching hreflang, not a trailing-slash /en/', () => {
    const entries = sitemapHomeEntries('https://prospectlyonboard.com');
    assert.deepEqual(entries, [
      {
        url: 'https://prospectlyonboard.com/',
        alternates: {
          languages: {
            'pt-BR': 'https://prospectlyonboard.com/',
            en: 'https://prospectlyonboard.com/en',
          },
        },
      },
      {
        url: 'https://prospectlyonboard.com/en',
        alternates: {
          languages: {
            'pt-BR': 'https://prospectlyonboard.com/',
            en: 'https://prospectlyonboard.com/en',
          },
        },
      },
    ]);
  });
});
