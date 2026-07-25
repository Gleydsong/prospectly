# Landing Premium Globe Redesign

**Date:** 2026-07-25  
**Status:** Approved  
**Scope:** `apps/landing` only

## Goal

Elevate the MVP landing from a simple photo/CTA band to a modern Minimal Spatial SaaS surface: zinc neutrals + cobalt accent, COBE WebGL globe as the hero visual, and a sharper operational-pain VP (Maps copy is not prospecting).

## Decisions

| Decision | Choice |
|----------|--------|
| Palette | **A** — Globe dictates: zinc/off-white + cobalt; emerald removed |
| Hero layout | Split 50/50: copy left, Globe right |
| VP angle | **1** — Operational pain (Maps manual is slow), sharper |
| Globe placement | Hero (replaces `hero-street.jpg`) |
| Problem image | Remove `no-website-shop.jpg`; text-led section |
| Tech | `cobe` WebGL particle globe, client island |

## Visual system

- **Aesthetic:** Minimal Spatial SaaS / soft data-viz (COBE family)
- **Tokens:** `--accent` cobalt `#2563EB` (light) / `#60A5FA` (dark); zinc surfaces
- **Typography:** Keep Outfit + JetBrains Mono
- **Motion:** Subtle hero fade-in; globe auto-rotate; respect `prefers-reduced-motion` (static frame / no rotate)

## Copy (PT)

- Headline: `Copiar lead do Maps` + highlight `não é prospecção.`
- Body: `Prospectly busca o nicho, corta quem já tem site e joga no pipeline. Sem manhã perdida no Maps.`
- EN mirror with the same intent

## Hero stack (max 4)

1. Brand wordmark (small)
2. Headline (≤2 lines)
3. Subtext (≤20 words)
4. Primary + secondary CTAs

No signal bullets inside the hero. Trust strip stays below.

## Out of scope

- Promo video / Remotion theme sync
- `apps/web` emerald alignment (follow-up)
- Full FAQ/pricing content rewrite
- Product.md / Design.md init (separate)

## Success criteria

- First viewport reads premium and product-led
- One accent color (cobalt) across landing
- Globe works on desktop; degrades gracefully on reduced motion / WebGL failure
- PT + EN strings updated
- `next build` / typecheck pass for `@prospectly/landing`
