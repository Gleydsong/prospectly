import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function source(relative: string): string {
  return readFileSync(join(landingRoot, relative), 'utf8');
}

describe('V2 Brand, Header & Footer checks', () => {
  it('V2Brand renders the full wordmark "Prospectly" next to the symbol', () => {
    const brand = source('src/components/landing-v2-brand.tsx');

    assert.match(brand, />Prospectly</);
    assert.doesNotMatch(brand, />rospectly</);
  });

  it('V2Footer does not link to pages that do not exist (About, Blog)', () => {
    const footer = source('src/components/landing-v2-footer.tsx');

    assert.doesNotMatch(footer, /footerLinkAbout|footerLinkBlog/);
  });

  it('V2Header has no fixed JSX text and delegates to i18n dictionary', () => {
    const header = source('src/components/landing-v2-header.tsx');

    // Nao deve conter strings soltas em portugues hardcoded no JSX
    assert.doesNotMatch(header, />Benefícios</);
    assert.doesNotMatch(header, />Dúvidas frequentes</);
    assert.doesNotMatch(header, /aria-label="Abrir menu"/);
    assert.doesNotMatch(header, /aria-label="Fechar menu"/);
    assert.doesNotMatch(header, /aria-label="Navegação principal"/);
    assert.doesNotMatch(header, /aria-label="Navegação móvel"/);

    // Deve usar as chaves i18n
    assert.match(header, /navBenefits/);
    assert.match(header, /navFaq/);
    assert.match(header, /navOpenMenu/);
    assert.match(header, /navCloseMenu/);
    assert.match(header, /navMainAriaLabel/);
    assert.match(header, /navMobileAriaLabel/);

    // O link do Produto mobile deve apontar para /#por-que ou equivalente en (funciona fora da home)
    assert.match(header, /isEn \? '\/en#por-que' : '\/#por-que'/);

    // Deve usar rotas en reais em locale === 'en'
    assert.match(header, /enterExplainerUrl\(locale\)/);
    assert.match(header, /canonicalFaqPath\(locale\)/);
  });

  it('SiteHeader, used by /en and legal pages, localizes the mobile menu labels', () => {
    // /en renders SiteHeader (site-chrome.tsx), not V2Header: its aria-labels must come from i18n too.
    const chrome = source('src/components/site-chrome.tsx');

    assert.doesNotMatch(chrome, /'Abrir menu'|'Fechar menu'/);
    assert.match(chrome, /t\(locale, 'navOpenMenu'\)/);
    assert.match(chrome, /t\(locale, 'navCloseMenu'\)/);
  });
});
