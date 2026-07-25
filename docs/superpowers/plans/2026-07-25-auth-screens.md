# Auth Screens Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign login and register as a shared split-screen AuthShell aligned with Prospectly landing/app brand.

**Architecture:** Shared `AuthShell` (brand panel + form slot + trust strip). Pages keep form/API logic. New copy via i18n.

**Tech Stack:** React, Vite, Tailwind, react-i18next, lucide-react, vitest

## Global Constraints

- Preserve existing auth fields and API contracts
- Visual: zinc + emerald, Outfit, `rounded-control`, light surfaces
- No fake social proof numbers
- `min-h-[100dvh]` (not `h-screen`)
- Zero em-dashes in visible copy
- PT + EN keys required for all new strings

---

### Task 1: i18n strings

**Files:**
- Modify: `apps/web/src/i18n/locales/pt.json`
- Modify: `apps/web/src/i18n/locales/en.json`

- [x] Add `auth.brandManifesto`, benefit titles/bodies (3), trust labels, refined titles/subtitles for form column
- [x] Keep existing field/error keys unchanged

### Task 2: AuthShell component

**Files:**
- Create: `apps/web/src/components/layout/auth-shell.tsx`
- Create: `apps/web/src/components/layout/auth-shell.spec.tsx`

- [x] Implement split layout + mobile stack
- [x] Props: `title`, `subtitle`, `children`
- [x] Brand panel + trust strip from i18n
- [x] Spec: renders title and trust text

### Task 3: Wire login + register

**Files:**
- Modify: `apps/web/src/pages/auth/login-page.tsx`
- Modify: `apps/web/src/pages/auth/register-page.tsx`

- [x] Wrap forms in `AuthShell`
- [x] Remove old centered-card chrome
- [x] Preserve submit/checkout behavior

### Task 4: Verify

- [x] `pnpm --filter @prospectly/web test`
- [x] `pnpm --filter @prospectly/web typecheck`
