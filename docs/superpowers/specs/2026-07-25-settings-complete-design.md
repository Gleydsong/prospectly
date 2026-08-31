# Página de configurações completa (UI sobre APIs existentes)

**Data:** 2026-07-25  
**Status:** Aprovado — implementação em `feat/settings-complete-ui`  
**Abordagem:** UI sobre APIs existentes (sem S3, sem convites por magic link)

## Objetivo

Tornar `/settings` um hub completo de conta alinhado ao app dark zinc + cobalt: perfil (nome + foto), renomear organização, billing polido, convidar membros para a org (pipeline/atividades compartilhados), página LGPD + exclusão de conta (DSR), scoring mais limpo.

## Escopo

### Dentro

1. **Card de perfil** — avatar (upload comprimido no client → `avatarUrl` data URL ou https), nome editável, e-mail somente leitura, locale
2. **Card de organização** — renomear via `PATCH /organizations/current` (OWNER/ADMIN)
3. **Card de billing** — linha de status + selects de moeda/intervalo quando não ACTIVE; portal/cancel quando disponível
4. **Card de membros** — listagem; modal de convite (nome, e-mail, role, senha temporária gerada + copiar); alteração de role + remoção para OWNER/ADMIN
5. **Card de privacidade** — link para `/settings/privacy`; export DSR; modal de exclusão de conta → DSR DELETE
6. **Página de privacidade** — resumo LGPD in-app + link para landing `/privacy`
7. **Scoring** — remover chaves técnicas abaixo dos rótulos

### Fora

- Convites por magic link / e-mail
- Object storage para avatares
- Hard-delete automatizado de contas
- Compartilhamento de pipeline entre orgs

## Alterações na API

- `UpdateProfileDto.avatarUrl`: aceitar `https://…` **ou** `data:image/(jpeg|png|webp);base64,…` com tamanho decodificado máx. ~120KB; aumentar max string length conforme necessário

## Rotas web

- `/settings` — hub
- `/settings/privacy` — resumo LGPD (protegida, AppLayout)

## Segurança / UX

- Senha temporária do convite exibida uma vez com copiar; avisar para compartilhar por canal seguro
- Exclusão de conta exige confirmação digitada (`EXCLUIR` / `DELETE`)
- RBAC: convidar/atualizar/remover membros e renomear org somente para OWNER/ADMIN; UI oculta ações caso contrário
