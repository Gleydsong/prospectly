# App UI color sync with landing

**Date:** 2026-07-25  
**Status:** Implemented  
**Scope:** `apps/web` (+ promo theme tokens for brand parity)

## Goal

Align the product app with the landing premium palette: zinc neutrals + cobalt accent (`#2563EB`), retiring emerald as brand color.

## Changes

- `tailwind.config.js` `brand.*` scale remapped to Tailwind blue / cobalt
- `index.css` CSS variables `--accent`, `--ring`, `::selection` → cobalt
- Hardcoded emerald status surfaces → `brand-*`
- Dashboard chart fills → cobalt blues
- Badge `green` / `purple` tones → brand soft blues
- `promo-video` theme emerald keys aliased to cobalt for future renders

## Out of scope

- Full dark-mode product shell
- Re-rendering Remotion MP4s
- Auth copy / layout redesign
