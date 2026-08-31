# Plano de implementação Landing Premium Globe

> **Para Claude:** SUB-SKILL OBRIGATÓRIA: Use superpowers:executing-plans para implementar este plano tarefa a tarefa.

**Objetivo:** Redesenhar a home de `apps/landing` com paleta cobalt, hero split + globo COBE, VP mais afiada na dor Maps.

**Arquitetura:** Tokens CSS definem accent; `ProspectlyGlobe` é uma ilha client envolvendo `cobe`; `ConversionBand` vira split assimétrico; seção de problema remove foto stock.

**Stack:** Next.js 15, React 18, Tailwind 3, Motion, `cobe`, ícones Phosphor.

---

### Task 1: Tokens de paleta

**Arquivos:** `apps/landing/src/app/globals.css`, `apps/landing/tailwind.config.ts`

- Substituir accent emerald por cobalt (`#2563EB` / hover `#1D4ED8`; dark `#60A5FA` / `#93C5FD`)
- Atualizar `--hero-wash` e `::selection` para tintas cobalt
- Alinhar Tailwind `accent.*` soft/ink à escala blue

### Task 2: Componente Globe

**Arquivos:** `apps/landing/src/components/prospectly-globe.tsx` (criar), `package.json` (+ `cobe`)

- Client component: canvas + `createGlobe`, auto-rotate, resize observer
- Marcadores/arcos cobalt; light/dark via `matchMedia`
- `useReducedMotion` → sem incremento de phi
- Cleanup `destroy()` no unmount

### Task 3: Hero + i18n

**Arquivos:** `conversion-band.tsx`, `i18n.ts`

- Layout split; remover imagem de rua e signal grid
- Conectar Globe à direita (empilhar abaixo do copy no mobile)
- Novo copy da banda CTA PT/EN

### Task 4: Seção de problema

**Arquivos:** `home-landing.tsx`

- Remover Reveal `no-website-shop.jpg`
- Bloco de problema single-column / text-forward; manter imagem da seção de filtros

### Task 5: Verificação

- `pnpm --filter @prospectly/landing typecheck` (ou equivalente no cwd)
- Sanity visual: hero cabe no viewport, accent consistente
