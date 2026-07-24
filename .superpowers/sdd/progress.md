# SDD Progress — Geo Selectors

**Branch:** `selectores`  
**Started:** 2026-07-24

## Status

| Task | Status | Notes |
|------|--------|-------|
| Design + plan | done | `docs/superpowers/specs/2026-07-24-geo-selectors-design.md` |
| API GeoService + unit | done | `country-state-city`, 6 unit tests |
| API Geo HTTP e2e | done | `geo.integration.spec.ts` |
| Web cascade selects | done | País → Região → Cidade |
| Verify + report | done | Ver `task-geo-selectors-report.md` |

## Decisions

- Cobertura: países já listados em prospecting
- Fonte: API + `country-state-city`
- Cascata: País → Região → Cidade
- Submit: BR envia UF (`code`); outros países enviam `name` da região
- Labels da lib em inglês (ex.: Lisbon)

## Changelog

- 2026-07-24: Spec e plan criados
- 2026-07-24: Módulo `geo` (service/controller/DTOs) + testes unit/integration
- 2026-07-24: Web hooks `useGeoRegions` / `useGeoCities` + SearchPage selects encadeados + testes
