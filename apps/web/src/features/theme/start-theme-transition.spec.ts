import { afterEach, describe, expect, it, vi } from 'vitest';

import { startThemeTransition } from './start-theme-transition';

describe('startThemeTransition', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove('theme-revealing');
    document.documentElement.style.removeProperty('--theme-x');
  });

  it('applies instantly when reduced motion is preferred', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    const apply = vi.fn();
    await startThemeTransition({ x: 10, y: 20 }, apply);
    expect(apply).toHaveBeenCalledOnce();
    expect(document.documentElement.classList.contains('theme-revealing')).toBe(false);
  });

  it('applies instantly when origin is null', async () => {
    const apply = vi.fn();
    await startThemeTransition(null, apply);
    expect(apply).toHaveBeenCalledOnce();
  });
});
