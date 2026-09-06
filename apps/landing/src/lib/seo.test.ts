import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLandingSitemap, landingAlternates, landingRobotsRules } from './seo.ts';

describe('landingRobotsRules', () => {
  it('allows Googlebot and Google-InspectionTool on /', () => {
    const rules = landingRobotsRules();
    const agents = rules.map((rule) => rule.userAgent);

    assert.deepEqual(agents, ['*', 'Googlebot', 'Google-InspectionTool']);
    for (const rule of rules) {
      assert.equal(rule.allow, '/');
      assert.equal(rule.disallow, undefined);
    }
  });
});

describe('landingAlternates', () => {
  it('pairs bilingual pricing pages and keeps canonical on the requested locale', () => {
    assert.deepEqual(landingAlternates('/pricing'), {
      canonical: '/pricing',
      languages: {
        'pt-BR': '/pricing',
        en: '/en/pricing',
        'x-default': '/pricing',
      },
    });
    assert.deepEqual(landingAlternates('/en/pricing'), {
      canonical: '/en/pricing',
      languages: {
        'pt-BR': '/pricing',
        en: '/en/pricing',
        'x-default': '/pricing',
      },
    });
  });

  it('does not advertise /en as the English home because that path redirects', () => {
    const home = landingAlternates('/');
    assert.equal(home.canonical, '/');
    assert.equal(home.languages['pt-BR'], '/');
    assert.equal(home.languages['x-default'], '/');
    assert.equal(home.languages.en, undefined);
  });
});

describe('buildLandingSitemap', () => {
  const lastModified = new Date('2026-09-05T00:00:00.000Z');

  it('excludes the redirecting /en home and adds hreflang on bilingual URLs', () => {
    const entries = buildLandingSitemap('https://prospectlyonboard.com', lastModified);
    const urls = entries.map((entry) => entry.url);

    assert.equal(urls.includes('https://prospectlyonboard.com/en'), false);
    assert.equal(urls.includes('https://prospectlyonboard.com/en/'), false);
    assert.ok(urls.includes('https://prospectlyonboard.com/'));
    assert.ok(urls.includes('https://prospectlyonboard.com/en/pricing'));

    const pricing = entries.find(
      (entry) => entry.url.endsWith('/pricing') && !entry.url.includes('/en/'),
    );
    assert.deepEqual(pricing?.alternates?.languages, {
      'pt-BR': 'https://prospectlyonboard.com/pricing',
      en: 'https://prospectlyonboard.com/en/pricing',
      'x-default': 'https://prospectlyonboard.com/pricing',
    });
  });
});
