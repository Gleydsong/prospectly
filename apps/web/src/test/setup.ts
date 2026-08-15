import '@testing-library/jest-dom/vitest';

import { ensureI18n } from '@/i18n';

// Vitest loads apps/web/.env when present (e.g. VITE_GOOGLE_CLIENT_ID).
// Production deploy builds reject empty/localhost values via build:deploy.
await ensureI18n('pt');
