# Design: Auth screens (login + register)

**Date:** 2026-07-25  
**Status:** Approved  
**Surface:** `apps/web` auth routes (`/login`, `/register`)

## Problem

Login and register are functional centered cards. They under-sell Prospectly at the conversion moment compared to marketing-grade auth (e.g. MedahLeads), while the landing already has a clear brand voice.

## Goals

- Redesign login and register as an inspirational, conversion-oriented experience.
- Keep Prospectly concepts: local B2B prospecting, no-website filter, OSM + Places, pipeline, LGPD, free searches.
- Align visuals with landing + app (zinc neutrals, emerald accent, Outfit).
- Preserve existing fields, validation, checkout `plan`/`currency` query flow, and i18n (`pt` / `en`).

## Non-goals

- Adding WhatsApp, CPF/CNPJ, or other MedahLeads-only fields
- Changing auth API contracts
- Dark-mode-only brand panel
- Heavy motion / product screenshot theater

## Decisions

| Topic | Choice |
|-------|--------|
| Layout | Split-screen (`AuthShell`): brand panel left, form right |
| Brand panel | Short manifesto + 3 Prospectly benefits |
| Trust | Trust strip below CTA on **both** login and register |
| Visual | Light, aligned to landing/app (`hero-wash` style + emerald) |
| Structure | Shared `AuthShell`; pages own only form logic |
| Mobile | Stack: compact brand block on top, form below |
| Copy | New i18n keys under `auth.*`; no hardcoded PT/EN |

## Architecture

```
AuthShell
├── BrandPanel (manifesto + 3 benefits)
└── FormColumn
    ├── title / subtitle (slot or props)
    ├── children (form)
    └── TrustStrip
```

- `login-page.tsx` / `register-page.tsx` keep react-hook-form, zod, API calls.
- No API / Prisma changes.

## Content (concepts)

**Manifesto:** map → qualified local leads → pipeline (same promise as landing).

**Benefits (3):**

1. No-website filter  
2. OpenStreetMap + Google Places  
3. 3 free searches to validate  

**Trust strip:** SSL, LGPD-minded flow, free start (no invented ratings/company counts).

## Testing

- Unit: `AuthShell` renders brand + trust keys (i18n mock).  
- Manual: desktop split, mobile stack, login/register flows, plan query params.

## Out of scope follow-ups

- Language switcher on auth  
- Social login  
- Password visibility toggle (optional later)
