# Plano de implementação completa de Settings

> **Para agentes:** Implementar tarefa a tarefa na branch `feat/settings-complete-ui`.

**Objetivo:** Completar o hub de configurações (perfil, org, billing, convite de membros, página LGPD, polish de scoring) usando APIs existentes mais validação de avatar.

**Arquitetura:** Mudança fina na API para data URLs de avatar; módulos web de feature para org/members; página de settings composta por cards focados; nova rota de privacidade.

**Stack:** NestJS + class-validator, React + TanStack Query + i18next, Tailwind dark zinc/cobalt

## Restrições globais

- Apenas classes de tema escuro (zinc-950/900, brand cobalt)
- Sem novo storage provider
- Convite usa `POST /organizations/members` existente com senha temporária gerada no client
- DSR permanece stub (PENDING)

---

### Task 1: Validação de avatar na API

- Modificar: `apps/api/src/modules/users/dto/update-profile.dto.ts`
- Teste unitário opcional para helper de validação
- Aceitar URL https ou data image URL ≤120KB decodificado

### Task 2: Helpers web org + DSR API

- Adicionar/estender: `apps/web/src/features/organizations/api.ts` (ou auth api)
- `getCurrentOrg`, `updateOrg`, `inviteMember`, `updateMemberRole`, `removeMember`
- `requestDataExport` junto com deletion

### Task 3: Reescrita da UI de Settings + página de privacidade + i18n

- Reescrever `settings-page.tsx` (dividir cards se o arquivo crescer)
- Adicionar `settings-privacy-page.tsx` + rota em `App.tsx`
- Atualizar `pt.json` / `en.json`
- Helper de compressão de avatar em `lib/`
- Modal de convite com senha gerada

### Task 4: Verificação

- `pnpm --filter @prospectly/api exec tsc --noEmit` (ou script do projeto)
- `pnpm --filter @prospectly/web exec tsc -b --noEmit`
