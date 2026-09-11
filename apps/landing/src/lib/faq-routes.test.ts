import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canonicalFaqPath, FAQ_PERMANENT_REDIRECTS, sitemapFaqUrls } from './faq-routes';
import { faqPageJsonLd } from './faq-content';

describe('canonicalFaqPath', () => {
  it('uses the Portuguese doubts page and the English FAQ page', () => {
    assert.equal(canonicalFaqPath('pt'), '/duvidas');
    assert.equal(canonicalFaqPath('en'), '/en/faq');
  });
});

describe('FAQ_PERMANENT_REDIRECTS', () => {
  it('sends the duplicate Portuguese /faq to the canonical /duvidas', () => {
    assert.deepEqual(FAQ_PERMANENT_REDIRECTS, [
      { source: '/faq', destination: '/duvidas', statusCode: 301 },
    ]);
  });
});

describe('sitemapFaqUrls', () => {
  it('lists only the live FAQ URLs, not /faq', () => {
    const urls = sitemapFaqUrls('https://prospectlyonboard.com');
    assert.deepEqual(urls, [
      'https://prospectlyonboard.com/duvidas',
      'https://prospectlyonboard.com/en/faq',
    ]);
    assert.ok(!urls.includes('https://prospectlyonboard.com/faq'));
  });
});

describe('faqPageJsonLd', () => {
  it('emits FAQPage schema from the live Portuguese questions', () => {
    const jsonLd = faqPageJsonLd('pt');
    assert.equal(jsonLd['@type'], 'FAQPage');
    const first = jsonLd.mainEntity[0];
    assert.equal(first?.['@type'], 'Question');
    assert.equal(first?.name, 'O que o Prospectly faz?');
    assert.equal(first?.acceptedAnswer['@type'], 'Answer');
    assert.match(first?.acceptedAnswer.text ?? '', /OpenStreetMap/);
  });
});
