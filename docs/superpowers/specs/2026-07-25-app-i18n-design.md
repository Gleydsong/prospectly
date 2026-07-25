# Design: App locale (PT / EN)

**Date:** 2026-07-25  
**Status:** Approved  
**Branch:** `cursor/align-web-ui-mvp` (or follow-up `cursor/app-i18n`)

## Problem

The web app UI is hardcoded in Portuguese. Prospectly targets multiple countries; users need the product in their language. Chart and enum labels must also follow the active locale.

## Goals

- Support **`pt`** and **`en`** in the MVP.
- Choose locale at **account registration** (pre-selected from browser language).
- Allow change later in **Settings**.
- Persist preference on the **User** and apply it after every login.
- Translate authenticated shell + main pages + lead status / score labels + auth screens.

## Non-goals (MVP)

- Spanish or extra locales
- Language switcher in the header
- Translating transactional emails
- Translating the marketing landing (separate product surface)
- Organization-wide forced locale

## Decisions

| Topic | Choice |
|-------|--------|
| Approach | i18next + `User.locale` |
| Locales | `pt`, `en` |
| Register default | `navigator.language` → `pt*` ⇒ `pt`, else `en` |
| Change later | Settings only |
| Date formatting | `pt` → `pt-PT`, `en` → `en-GB` |
| Ownership | Per user, not per organization |

## Data model

```prisma
enum AppLocale {
  pt
  en
}

model User {
  // ...
  locale AppLocale @default(pt)
}
```

- Existing users get `pt` via default / migration.
- `RegisterDto.locale` required (`IsIn(['pt','en'])`).
- `UpdateProfileDto.locale` optional.
- `AuthUser` / auth response include `locale`.
- `GET /users/me` and `PATCH /users/me` expose `locale`.

## Frontend architecture

- Dependencies: `i18next`, `react-i18next`.
- Resources: `apps/web/src/i18n/locales/{pt,en}.json`.
- Bootstrap: init i18n in `main.tsx`; sync `i18n.language` when auth user loads / locale updates.
- Helpers: `detectBrowserLocale()`, `toDateLocale(appLocale)`.
- `lead-status` labels move into translation keys (`status.NEW`, etc.).
- Register: select PT/EN with browser-detected default.
- Settings: card “Language / Idioma” calling `PATCH /users/me`.

## UX copy rules

- Keys organized by namespace: `common`, `nav`, `auth`, `dashboard`, `leads`, `settings`, …
- No mixed languages in one session after preference is set.
- Fallback language: `en` if a key is missing in `pt` (and vice-versa only if needed; primary fallback `en`).

## Testing

- API: register persists locale; patch updates locale; auth payload includes locale.
- Web: browser detect helper unit tests; settings update syncs i18n; dashboard status chart uses translated labels.

## Risks

- Large string surface — ship shell + main flows first; leftover PT strings are follow-ups.
- Auth store persistence must update `user.locale` after settings change without full re-login.
