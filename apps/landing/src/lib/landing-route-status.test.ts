import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LANDING_ROUTE_STATUS } from './landing-route-status';

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const errorFiles = [
  'app/(pt)/error.tsx',
  'app/en/error.tsx',
  'app/global-error.tsx',
] as const;

const notFoundFiles = ['app/(pt)/not-found.tsx', 'app/en/not-found.tsx'] as const;
const catchAllFiles = ['app/(pt)/[...slug]/page.tsx', 'app/en/[...slug]/page.tsx'] as const;

const loadingFiles = ['app/(pt)/loading.tsx', 'app/en/loading.tsx'] as const;

describe('landing route status copy', () => {
  it('keeps branded not-found copy without a technical dump', () => {
    assert.match(LANDING_ROUTE_STATUS.pt.notFound.title, /não existe/i);
    assert.match(LANDING_ROUTE_STATUS.en.notFound.title, /does not exist/i);
    assert.equal(LANDING_ROUTE_STATUS.pt.notFound.homeHref, '/');
    assert.equal(LANDING_ROUTE_STATUS.en.notFound.homeHref, '/en');
  });

  it('keeps error copy independent from thrown Error message and stack', () => {
    const thrown = new Error('SECRET_STACK_TRACE');
    thrown.stack = 'SECRET_STACK_TRACE\n    at Object.<anonymous>';
    const pt = LANDING_ROUTE_STATUS.pt.error;
    const en = LANDING_ROUTE_STATUS.en.error;
    assert.equal(pt.title, 'Não foi possível abrir esta página.');
    assert.equal(en.retryLabel, 'Try again');
    assert.doesNotMatch(pt.title, /SECRET_STACK_TRACE/);
    assert.doesNotMatch(pt.body, /SECRET_STACK_TRACE/);
    assert.doesNotMatch(en.body, /SECRET_STACK_TRACE/);
    assert.equal(thrown.message, 'SECRET_STACK_TRACE');
  });
});

describe('landing route status files', () => {
  it('does not render error.message or error.stack in route error UIs', () => {
    for (const relative of errorFiles) {
      const source = readFileSync(join(landingRoot, relative), 'utf8');
      assert.doesNotMatch(source, /error\.message/);
      assert.doesNotMatch(source, /error\.stack/);
      assert.match(source, /retry|reset/);
      assert.match(source, /'use client'/);
    }
  });

  it('ships branded not-found files for unmatched URLs and both marketing trees', () => {
    for (const relative of notFoundFiles) {
      const source = readFileSync(join(landingRoot, relative), 'utf8');
      assert.match(source, /LandingNotFoundScreen|notFound/);
    }
    for (const relative of catchAllFiles) {
      const source = readFileSync(join(landingRoot, relative), 'utf8');
      assert.match(source, /notFound\(/);
    }
  });

  it('ships a simple loading UI on the Portuguese and English marketing segments', () => {
    for (const relative of loadingFiles) {
      const source = readFileSync(join(landingRoot, relative), 'utf8');
      assert.match(source, /LandingRouteLoading/);
    }
    const ui = readFileSync(join(landingRoot, 'components/landing-route-status.tsx'), 'utf8');
    assert.match(ui, /role="status"/);
    assert.match(ui, /aria-busy="true"/);
  });
});
