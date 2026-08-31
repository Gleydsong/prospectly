# Design: telas de auth (login + register)

**Data:** 2026-07-25  
**Status:** Aprovado  
**Superfície:** rotas de auth em `apps/web` (`/login`, `/register`)

## Problema

Login e register são cards centralizados funcionais. Sub-vendem o Prospectly no momento de conversão comparado a auth de nível marketing (ex.: MedahLeads), enquanto a landing já tem voz de marca clara.

## Objetivos

- Redesenhar login e register como experiência inspiradora e orientada à conversão.
- Manter conceitos Prospectly: prospecção B2B local, filtro sem site, OSM + Places, pipeline, LGPD, buscas grátis.
- Alinhar visual com landing + app (neutros zinc, acento emerald, Outfit).
- Preservar campos existentes, validação, fluxo de checkout com query `plan`/`currency` e i18n (`pt` / `en`).

## Não-objetivos

- Adicionar WhatsApp, CPF/CNPJ ou outros campos exclusivos do MedahLeads
- Alterar contratos da API de auth
- Painel de marca só dark mode
- Motion pesada / teatro de screenshot do produto

## Decisões

| Tema | Escolha |
|------|---------|
| Layout | Split-screen (`AuthShell`): painel de marca à esquerda, formulário à direita |
| Painel de marca | Manifesto curto + 3 benefícios Prospectly |
| Confiança | Faixa de confiança abaixo do CTA em **login e register** |
| Visual | Claro, alinhado a landing/app (estilo `hero-wash` + emerald) |
| Estrutura | `AuthShell` compartilhado; páginas só com lógica do form |
| Mobile | Stack: bloco de marca compacto em cima, form embaixo |
| Copy | Novas chaves i18n em `auth.*`; sem PT/EN hardcoded |

## Arquitetura

```
AuthShell
├── BrandPanel (manifesto + 3 benefícios)
└── FormColumn
    ├── title / subtitle (slot ou props)
    ├── children (form)
    └── TrustStrip
```

- `login-page.tsx` / `register-page.tsx` mantêm react-hook-form, zod, chamadas API.
- Sem alterações em API / Prisma.

## Conteúdo (conceitos)

**Manifesto:** mapa → leads locais qualificados → pipeline (mesma promessa da landing).

**Benefícios (3):**

1. Filtro sem site  
2. OpenStreetMap + Google Places  
3. 3 buscas grátis para validar  

**Faixa de confiança:** SSL, fluxo mindful de LGPD, início grátis (sem ratings/contagens de empresas inventados).

## Testes

- Unit: `AuthShell` renderiza chaves de marca + confiança (mock i18n).  
- Manual: split desktop, stack mobile, fluxos login/register, query params de plano.

## Follow-ups fora de escopo

- Seletor de idioma na auth  
- Login social  
- Toggle de visibilidade de senha (opcional depois)
