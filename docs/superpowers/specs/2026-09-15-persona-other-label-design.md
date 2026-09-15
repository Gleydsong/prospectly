# Design: texto livre quando a persona é Outro (v1.1)

**Data:** 2026-09-15  
**Status:** Aprovado em conversa (humano). Pronto para implementar.  
**Branch:** `feat/persona-other-label`  
**Base:** `origin/main` @ `623a81a`  
**Supersede (parcial):** spec v1 decisão 2 — “No free-text persona in v1”. Enum continua fechado; Outro ganha um **rótulo** persistido.

## Problem Statement

No onboarding “Como você trabalha?”, escolher **Outro** não deixa o utilizador dizer o que é. O valor `outro` no enum não aparece de forma útil no CRM. O humano pediu: campo abaixo do select, **persistido**, e uma **tag abaixo do nome** no menu de conta.

## Solution

O enum `ProfessionalPersona` não muda. Quando `defaultPersona === outro`, a organização guarda `personaOtherLabel` (texto 2–40). A API recusa `outro` sem texto e anula o texto se a persona deixar de ser `outro`. A sessão devolve o rótulo. O sidebar mostra uma tag entre o nome e o e-mail.

## Language

| Termo | Significado | Avoid |
| --- | --- | --- |
| **Persona profissional** | Enum fechado (inalterado). | Job title livre como enum |
| **Rótulo Outro** | Texto da org quando a persona default é `outro`. Campo `personaOtherLabel`. | Nova persona no enum, override de texto no User |
| **Tag de persona** | Badge no sidebar sob o nome de login. | Card amber, notice |

Override de membro (v1) **não** ganha texto próprio nesta fatia. Se a persona efetiva for `outro`, a tag usa o rótulo da **organização**.

## User Stories

1. As an OWNER no onboarding Google, I want an input under the select when I pick Outro, so that I can name how we work.
2. As a visitante no registo email, I want the same input, so that signup matches onboarding.
3. As an OWNER/ADMIN in Settings, I want to edit that label, so that it can change later.
4. As any signed-in member, I want a tag under my login name with the persona (custom text if Outro), so that the mold is visible without opening Settings.
5. As the API, I want `outro` without a label to 400, so that we never persist an empty Outro.

## Implementation Decisions

1. **Column:** `Organization.personaOtherLabel String?`. Null when default persona is not `outro`.
2. **Length:** trim; min 2, max 40; no empty string (store `null` instead).
3. **Write paths:** register, Google auth when persona is sent, `PATCH /organizations/current/persona`. Payload `{ defaultPersona, personaOtherLabel? }`.
4. **Read paths:** `buildAuthResponse.user.personaOtherLabel`; `GET /organizations/current` includes the field.
5. **Normalize:** if persona ≠ `outro` → `personaOtherLabel = null` even if the client sent text.
6. **UI:** Input appears only when select is `outro`. Required before submit. Same on register, onboarding, settings (org default).
7. **Sidebar:** between `user.name` and `user.email`, `Badge` slate. Copy: if `effectivePersona === 'outro'` use `personaOtherLabel` (fallback i18n `persona.outro`); else `t('persona.' + effectivePersona)`.
8. **No member other-label** in this slice. No i18n key deletion elsewhere. No cards amber.
9. **Migration:** additive nullable column. Existing rows stay `null`; orgs with `outro` and null label keep working until next OWNER patch (onboarding already forced a choice; treat null as show i18n Outro).
10. **Tests:** DTO/service 400 without label; register outro+label persists; switching to vendedor clears column; onboarding test shows/hides input; sidebar test shows tag.

## Out of scope

- Texto livre no override do membro.
- Mudar o enum ou o módulo Website.
- Tag no header compacto (só o bloco da conta no fundo do sidebar).
