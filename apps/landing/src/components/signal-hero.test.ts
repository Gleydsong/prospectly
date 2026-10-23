import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { shouldLoadHero3D } from '../lib/should-load-hero-3d';

const landingRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function source(relative: string): string {
  return readFileSync(join(landingRoot, relative), 'utf8');
}

describe('SignalHero 3D & Static Fallback', () => {
  it('implements static SVG fallback with aria-hidden and signal ring gradient', () => {
    const fallback = source('components/signal-hero-fallback.tsx');
    assert.match(fallback, /<svg/);
    assert.match(fallback, /id="ringGrad"/);
    assert.match(fallback, /id="limeSphereGrad"/);
    assert.match(fallback, /aria-hidden="true"/);
  });

  it('implements Three.js 3D scene with physical materials, clearcoat, and studio lighting', () => {
    const scene3d = source('components/signal-hero-3d.tsx');
    assert.match(scene3d, /MeshPhysicalMaterial/);
    assert.match(scene3d, /clearcoat/);
    assert.match(scene3d, /ACESFilmicToneMapping/);
    assert.match(scene3d, /TorusGeometry/);
    assert.match(scene3d, /SphereGeometry/);
    assert.match(scene3d, /requestAnimationFrame/);
    assert.match(scene3d, /cancelAnimationFrame/);
  });

  it('loads 3D lazily with dynamic import and fallback without blocking SSR/LCP', () => {
    const heroScene = source('components/signal-hero-scene.tsx');
    assert.match(heroScene, /dynamic\(/);
    assert.match(heroScene, /ssr:\s*false/);
    assert.match(heroScene, /prefers-reduced-motion/);
    assert.match(heroScene, /SignalHeroFallback/);
    assert.match(heroScene, /requestIdleCallback/);
    assert.match(heroScene, /IntersectionObserver/);
    assert.match(heroScene, /shouldLoadHero3D/);
  });
});

describe('shouldLoadHero3D pure decision function', () => {
  it('does NOT load when mobile media query matches (max-width: 767px)', () => {
    assert.equal(shouldLoadHero3D({ isMobile: true }), false);
    assert.equal(shouldLoadHero3D({ matchesMobileMedia: true }), false);
  });

  it('does NOT load when navigator.connection?.saveData is true', () => {
    assert.equal(shouldLoadHero3D({ saveData: true }), false);
  });

  it('does NOT load when navigator.hardwareConcurrency <= 4', () => {
    assert.equal(shouldLoadHero3D({ hardwareConcurrency: 1 }), false);
    assert.equal(shouldLoadHero3D({ hardwareConcurrency: 2 }), false);
    assert.equal(shouldLoadHero3D({ hardwareConcurrency: 4 }), false);
  });

  it('does NOT load in prefers-reduced-motion', () => {
    assert.equal(shouldLoadHero3D({ prefersReducedMotion: true }), false);
  });

  it('loads ONLY on desktop with adequate hardware, no saveData, and no reduced motion', () => {
    assert.equal(
      shouldLoadHero3D({
        isMobile: false,
        matchesMobileMedia: false,
        saveData: false,
        hardwareConcurrency: 8,
        prefersReducedMotion: false,
      }),
      true,
    );
  });
});
