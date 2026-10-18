import { LEAD_STATUS_COLORS } from '@/lib/lead-status-colors';

export const THEME_STORAGE_KEY = 'prospectly:theme';

export type ThemeMode = 'dark' | 'light';

export function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark') return raw;
  } catch {
    /* private mode / blocked storage */
  }
  return 'light';
}

export function writeStoredTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyThemeClass(theme: ThemeMode): void {
  const root = document.documentElement;
  for (const [status, colors] of Object.entries(LEAD_STATUS_COLORS)) {
    for (const [token, value] of Object.entries(colors[theme])) {
      root.style.setProperty(`--lead-status-${status}-${token}`, value);
    }
  }
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
  root.dataset.theme = theme;

  const metaScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaScheme) metaScheme.setAttribute('content', theme);

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'light' ? '#f4f6fb' : '#0f172a');
  }
}
