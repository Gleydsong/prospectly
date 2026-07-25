# Landing Premium Globe Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign `apps/landing` home with cobalt palette, split hero + COBE globe, sharper Maps-pain VP.

**Architecture:** CSS tokens drive accent; `ProspectlyGlobe` is a client island wrapping `cobe`; `ConversionBand` becomes asymmetric split; problem section drops stock photo.

**Tech Stack:** Next.js 15, React 18, Tailwind 3, Motion, `cobe`, Phosphor icons.

---

### Task 1: Palette tokens

**Files:** `apps/landing/src/app/globals.css`, `apps/landing/tailwind.config.ts`

- Replace emerald accent with cobalt (`#2563EB` / hover `#1D4ED8`; dark `#60A5FA` / `#93C5FD`)
- Update `--hero-wash` and `::selection` to cobalt tints
- Align Tailwind `accent.*` soft/ink to blue scale

### Task 2: Globe component

**Files:** `apps/landing/src/components/prospectly-globe.tsx` (create), `package.json` (+ `cobe`)

- Client component: canvas + `createGlobe`, auto-rotate, resize observer
- Cobalt markers/arcs; light/dark via `matchMedia`
- `useReducedMotion` → no phi increment
- Cleanup `destroy()` on unmount

### Task 3: Hero + i18n

**Files:** `conversion-band.tsx`, `i18n.ts`

- Split layout; remove street image and signal grid
- Wire Globe on the right (stack below copy on mobile)
- New CTA band copy PT/EN

### Task 4: Problem section

**Files:** `home-landing.tsx`

- Remove `no-website-shop.jpg` Reveal
- Single-column / text-forward problem block; keep filter section image

### Task 5: Verify

- `pnpm --filter @prospectly/landing typecheck` (or cwd equivalent)
- Visual sanity: hero fits viewport, accent consistent
