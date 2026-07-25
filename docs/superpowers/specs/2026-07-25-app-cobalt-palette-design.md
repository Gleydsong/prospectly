# App UI color sync with landing

**Date:** 2026-07-25  
**Status:** Implemented  
**Scope:** `apps/web` (+ promo theme tokens for brand parity)

## Goal

Align the product app with the landing premium palette: zinc neutrals + cobalt accent (`#2563EB` light / `#60A5FA` dark), retiring emerald as brand color — and ship the app in **dark mode** so it matches the landing visual system.

## Changes

- `tailwind.config.js` `brand.*` scale remapped to Tailwind blue / cobalt
- `index.css` forced dark tokens (`--bg: #09090b`, `--accent: #60a5fa`)
- `index.html` `class="dark"`, `color-scheme` / `theme-color`
- UI primitives + layouts (app/auth/sidebar/header) on zinc-950 / zinc-900 surfaces
- Pages remapped: `bg-white` → `bg-zinc-900`, light borders/text → dark counterparts, soft brand tints → `brand-500/15`
- Hardcoded emerald status surfaces → `brand-*`
- Dashboard chart fills → cobalt blues
- Badge `green` / `purple` tones → brand soft blues
- `promo-video` theme emerald keys aliased to cobalt for future renders

## Out of scope

- User-toggleable light/dark theme
- Re-rendering Remotion MP4s
- Auth copy / layout redesign
