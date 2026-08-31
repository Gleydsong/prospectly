# Design: locale do app (PT / EN)

**Data:** 2026-07-25  
**Status:** Aprovado  
**Branch:** `cursor/align-web-ui-mvp` (ou follow-up `cursor/app-i18n`)

## Problema

A UI do app web está hardcoded em português. O Prospectly atende vários países; usuários precisam do produto no idioma deles. Rótulos de gráficos e enums também devem seguir o locale ativo.

## Objetivos

- Suportar **`pt`** e **`en`** no MVP.
- Escolher locale no **cadastro** (pré-selecionado pelo idioma do browser).
- Permitir alteração depois em **Settings**.
- Persistir preferência no **User** e aplicá-la após todo login.
- Traduzir shell autenticado + páginas principais + status de lead / rótulos de score + telas de auth.

## Não-objetivos (MVP)

- Espanhol ou locales extras
- Seletor de idioma no header
- Traduzir e-mails transacionais
- Traduzir landing de marketing (superfície de produto separada)
- Locale forçado por organização

## Decisões

| Tema | Escolha |
|------|---------|
| Abordagem | i18next + `User.locale` |
| Locales | `pt`, `en` |
| Default no register | `navigator.language` → `pt*` ⇒ `pt`, senão `en` |
| Alteração depois | Somente Settings |
| Formatação de data | `pt` → `pt-PT`, `en` → `en-GB` |
| Ownership | Por usuário, não por organização |

## Modelo de dados

```prisma
enum AppLocale {
  pt
  en
}

model User {
  // ...
  locale AppLocale @default(pt)
}
```

- Usuários existentes recebem `pt` via default / migration.
- `RegisterDto.locale` obrigatório (`IsIn(['pt','en'])`).
- `UpdateProfileDto.locale` opcional.
- `AuthUser` / resposta de auth incluem `locale`.
- `GET /users/me` e `PATCH /users/me` expõem `locale`.

## Arquitetura frontend

- Dependências: `i18next`, `react-i18next`.
- Resources: `apps/web/src/i18n/locales/{pt,en}.json`.
- Bootstrap: init i18n em `main.tsx`; sincronizar `i18n.language` quando user auth carrega / locale atualiza.
- Helpers: `detectBrowserLocale()`, `toDateLocale(appLocale)`.
- Rótulos de `lead-status` migram para chaves de tradução (`status.NEW`, etc.).
- Register: select PT/EN com default detectado do browser.
- Settings: card “Language / Idioma” chamando `PATCH /users/me`.

## Regras de copy UX

- Chaves organizadas por namespace: `common`, `nav`, `auth`, `dashboard`, `leads`, `settings`, …
- Sem idiomas misturados na mesma sessão após preferência definida.
- Idioma fallback: `en` se faltar chave em `pt` (e vice-versa só se necessário; fallback primário `en`).

## Testes

- API: register persiste locale; patch atualiza locale; payload auth inclui locale.
- Web: unit tests do helper de detect browser; update settings sincroniza i18n; gráfico de status no dashboard usa rótulos traduzidos.

## Riscos

- Superfície grande de strings — entregar shell + fluxos principais primeiro; strings PT restantes são follow-ups.
- Persistência do auth store deve atualizar `user.locale` após mudança em settings sem re-login completo.
