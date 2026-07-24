# Report — Geo Selectors (País → Região → Cidade)

**Branch:** `selectores`  
**Date:** 2026-07-24

## O que foi feito

### Backend
- Dependência `country-state-city`
- Módulo Nest `GeoModule`:
  - `GET /api/v1/geo/regions?country=XX`
  - `GET /api/v1/geo/cities?country=XX&region=CODE`
- Validação: só países de `PROSPECTING_COUNTRY_CODES`
- Testes unitários (`geo.service.spec.ts`) e HTTP integration (`geo.integration.spec.ts`)

### Frontend
- `fetchGeoRegions` / `fetchGeoCities` + hooks React Query
- SearchPage: selects Região e Cidade (sem texto livre)
- Cascata: muda país → limpa região/cidade; muda região → limpa cidade; cidade desabilitada até região
- Submit mapeia região: BR = código UF; demais = nome da região

### Documentação
- Spec: `docs/superpowers/specs/2026-07-24-geo-selectors-design.md`
- Plan: `docs/superpowers/plans/2026-07-24-geo-selectors.md`
- Progress: `.superpowers/sdd/progress.md`

## Como validar na UI

1. Login `demo@prospectly.dev` / `Demo123!`
2. Pesquisa → escolher país
3. Selecionar região na lista
4. Selecionar cidade na lista
5. Confirmar submit (BR mantém UF; PT envia nome da região, ex. Lisbon)

## Testes executados

- API `modules/geo`: 8 passed
- Web `search-page.test.tsx`: 9 passed
- `prospecting.integration.spec.ts`: passed
