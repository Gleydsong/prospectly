# Plano de implementação Google Places Provider

> **Para agentes:** Execução inline (usuário pediu imediato).

**Objetivo:** Provider Google Places opcional ao lado do OSM, OSM como default, ocultar Google quando key ausente.

**Arquitetura:** `SearchProviderRegistry` resolve provider por id; novo `GooglePlacesProvider`; `GET /searches/providers`; select na UI.

**Stack:** NestJS, Places API (New) Text Search, React Query, Zod

## Restrições globais

- Não quebrar testes OSM nem caminho default de create
- Nunca logar/expor API key
- Sanitizar erros de provider como OSM

---

### Task 1: Domain + provider Google

**Arquivos:**
- Modificar: `apps/api/src/modules/prospecting/domain/search-provider.ts`
- Modificar: `apps/api/src/modules/prospecting/domain/normalized-business.ts`
- Criar: `apps/api/src/modules/prospecting/infrastructure/google-places.provider.ts`
- Criar: `apps/api/src/modules/prospecting/infrastructure/google-places.provider.spec.ts`
- Modificar: `apps/api/src/config/configuration.ts`, `validation.ts`, `.env.example`

### Task 2: Conexão service/controller

**Arquivos:**
- Modificar: `prospecting.module.ts`, `prospecting.service.ts`, `create-search.dto.ts`, `prospecting.controller.ts`
- Modificar: `prospecting.service.spec.ts`

### Task 3: UI Web

**Arquivos:**
- Modificar: `apps/web/src/types/index.ts`, `features/prospecting/api.ts`, `hooks.ts`, `pages/search-page.tsx`, `search-page.test.tsx`
