import { afterEach, describe, expect, it } from 'vitest';

import { applyThemeClass, readStoredTheme, THEME_STORAGE_KEY, writeStoredTheme } from './theme-storage';

describe('theme-storage', () => {
  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove('light', 'dark');
    delete document.documentElement.dataset.theme;
  });

  it('defaults to light when nothing stored', () => {
    expect(readStoredTheme()).toBe('light');
  });

  it('persists and reads dark theme', () => {
    writeStoredTheme('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('applyThemeClass toggles html classes and color-scheme', () => {
    applyThemeClass('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');

    applyThemeClass('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
