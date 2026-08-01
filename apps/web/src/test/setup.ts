import '@testing-library/jest-dom/vitest';

import i18n from '@/i18n';

// Vitest loads apps/web/.env when present (e.g. VITE_GOOGLE_CLIENT_ID).
// Production code already falls back for VITE_API_URL / VITE_LANDING_URL;
// Google OAuth UI requires GoogleOAuthProvider — use renderWithProviders from @/test/render.
await i18n.changeLanguage('pt');
