import '@testing-library/jest-dom/vitest';

import i18n from '@/i18n';

// Node 25+ exposes a non-functional `localStorage` global that shadows jsdom's.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return memory.size;
      },
      clear: () => memory.clear(),
      getItem: (key: string) => memory.get(key) ?? null,
      key: (index: number) => [...memory.keys()][index] ?? null,
      removeItem: (key: string) => {
        memory.delete(key);
      },
      setItem: (key: string, value: string) => {
        memory.set(key, String(value));
      },
    } satisfies Storage,
  });
}

// Vitest loads apps/web/.env when present (e.g. VITE_GOOGLE_CLIENT_ID).
// Production code already falls back for VITE_API_URL / VITE_LANDING_URL;
// Google OAuth UI requires GoogleOAuthProvider — use renderWithProviders from @/test/render.
await i18n.changeLanguage('pt');


// Vitest loads apps/web/.env when present (e.g. VITE_GOOGLE_CLIENT_ID).
// Production code already falls back for VITE_API_URL / VITE_LANDING_URL;
// Google OAuth UI requires GoogleOAuthProvider — use renderWithProviders from @/test/render.
await i18n.changeLanguage('pt');
