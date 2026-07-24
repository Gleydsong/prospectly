# Google Places Provider Implementation Plan

> **For agentic workers:** Inline execution (user requested immediate).

**Goal:** Optional Google Places provider beside OSM, default OSM, hide Google when key missing.

**Architecture:** `SearchProviderRegistry` resolves provider by id; new `GooglePlacesProvider`; `GET /searches/providers`; UI select.

**Tech Stack:** NestJS, Places API (New) Text Search, React Query, Zod

## Global Constraints

- Do not break OSM tests or default create path
- Never log/expose API key
- Sanitize provider errors like OSM

---

### Task 1: Domain + Google provider

**Files:**
- Modify: `apps/api/src/modules/prospecting/domain/search-provider.ts`
- Modify: `apps/api/src/modules/prospecting/domain/normalized-business.ts`
- Create: `apps/api/src/modules/prospecting/infrastructure/google-places.provider.ts`
- Create: `apps/api/src/modules/prospecting/infrastructure/google-places.provider.spec.ts`
- Modify: `apps/api/src/config/configuration.ts`, `validation.ts`, `.env.example`

### Task 2: Service/controller wiring

**Files:**
- Modify: `prospecting.module.ts`, `prospecting.service.ts`, `create-search.dto.ts`, `prospecting.controller.ts`
- Modify: `prospecting.service.spec.ts`

### Task 3: Web UI

**Files:**
- Modify: `apps/web/src/types/index.ts`, `features/prospecting/api.ts`, `hooks.ts`, `pages/search-page.tsx`, `search-page.test.tsx`
