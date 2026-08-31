# Sincronização de cores da UI do app com a landing

**Data:** 2026-07-25  
**Status:** Implementado  
**Escopo:** `apps/web` (+ tokens de tema promo para paridade de marca)

## Objetivo

Alinhar o app de produto com a paleta premium da landing: neutros zinc + acento cobalt (`#2563EB` light / `#60A5FA` dark), aposentando emerald como cor de marca — e entregar o app em **dark mode** para combinar com o sistema visual da landing.

## Alterações

- Escala `brand.*` em `tailwind.config.js` remapeada para Tailwind blue / cobalt
- `index.css` com tokens dark forçados (`--bg: #09090b`, `--accent: #60a5fa`)
- `index.html` com `class="dark"`, `color-scheme` / `theme-color`
- Primitivas UI + layouts (app/auth/sidebar/header) em superfícies zinc-950 / zinc-900
- Páginas remapeadas: `bg-white` → `bg-zinc-900`, bordas/texto light → equivalentes dark, tintes brand suaves → `brand-500/15`
- Superfícies de status emerald hardcoded → `brand-*`
- Preenchimentos de gráficos no dashboard → azuis cobalt
- Tons de badge `green` / `purple` → brand soft blues
- Chaves emerald do tema `promo-video` aliased para cobalt em renders futuros

## Fora de escopo

- Tema light/dark alternável pelo usuário
- Re-renderizar MP4s Remotion
- Redesign de copy / layout da auth
