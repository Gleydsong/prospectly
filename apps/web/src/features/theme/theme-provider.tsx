import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  applyThemeClass,
  readStoredTheme,
  writeStoredTheme,
  type ThemeMode,
} from './theme-storage';
import { startThemeTransition } from './start-theme-transition';

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode, origin?: { x: number; y: number } | null) => void;
  toggleTheme: (origin?: { x: number; y: number } | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : readStoredTheme();
  });

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode, origin: { x: number; y: number } | null = null) => {
    void startThemeTransition(origin, () => {
      writeStoredTheme(next);
      applyThemeClass(next);
      setThemeState(next);
    });
  }, []);

  const toggleTheme = useCallback(
    (origin: { x: number; y: number } | null = null) => {
      setTheme(theme === 'dark' ? 'light' : 'dark', origin);
    },
    [setTheme, theme],
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
