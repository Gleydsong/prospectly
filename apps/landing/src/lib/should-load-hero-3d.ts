export interface ShouldLoadHero3DOptions {
  isMobile?: boolean;
  matchesMobileMedia?: boolean;
  saveData?: boolean;
  hardwareConcurrency?: number;
  prefersReducedMotion?: boolean;
}

/**
 * Pure decision function to determine if the Three.js 3D hero scene should be loaded.
 *
 * Rules:
 * - Does NOT load when matchMedia('(max-width: 767px)') matches (isMobile / matchesMobileMedia is true).
 * - Does NOT load when navigator.connection?.saveData is true.
 * - Does NOT load when navigator.hardwareConcurrency <= 4.
 * - Does NOT load in prefers-reduced-motion.
 * - Only loads on desktop with adequate hardware, no data-saver, and no reduced motion preference.
 */
export function shouldLoadHero3D(options: ShouldLoadHero3DOptions): boolean {
  if (options.isMobile || options.matchesMobileMedia) {
    return false;
  }
  if (options.saveData) {
    return false;
  }
  if (typeof options.hardwareConcurrency === 'number' && options.hardwareConcurrency <= 4) {
    return false;
  }
  if (options.prefersReducedMotion) {
    return false;
  }
  return true;
}

/**
 * Helper to inspect the client browser environment and extract conditions.
 */
export function getHero3DBrowserConditions(): ShouldLoadHero3DOptions {
  if (typeof window === 'undefined') {
    return {
      isMobile: true,
      matchesMobileMedia: true,
      saveData: true,
      hardwareConcurrency: 1,
      prefersReducedMotion: true,
    };
  }

  const matchesMobile = window.matchMedia?.('(max-width: 767px)').matches ?? false;
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const nav = window.navigator as Navigator & {
    connection?: { saveData?: boolean };
  };
  const saveData = Boolean(nav.connection?.saveData);
  const hardwareConcurrency = nav.hardwareConcurrency;

  return {
    isMobile: matchesMobile,
    matchesMobileMedia: matchesMobile,
    saveData,
    hardwareConcurrency,
    prefersReducedMotion: prefersReduced,
  };
}
