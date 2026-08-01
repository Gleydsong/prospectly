# Dependências — exceções e política de audit

Atualizado: **2026-08-01** (Fase 0.3).

## Política de CI

| Nível | Comportamento |
|-------|----------------|
| **critical** | Bloqueia (`pnpm audit --audit-level=critical`) |
| **high (runtime)** | Bloqueia via `node scripts/audit-runtime.cjs` |
| **high (toolchain)** | Permitido só se listado abaixo com **dono**, **risco residual** e **data de expiração** |
| moderate/low | Monitorado |

Não usar `continue-on-error: true` permanente no audit high de runtime.

## Remediações aplicadas (0.3)

| Pacote | Ação | Advisory / nota |
|--------|------|-----------------|
| `react-router` / `react-router-dom` | Upgrade para `^7.18.2` | [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) — patch na linha 7.x é `>=7.18.2`. App web é **SPA Vite** e **não usa unstable RSC**; mesmo assim atualizamos o patch. |
| `postcss` | `pnpm.overrides` `>=8.5.18` | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) — transitiva via Next |
| `multer` | Override `^2.0.2` (já resolvido em `@nestjs/platform-express@10.4.22`) | Upload CSV: 1 arquivo/request + limite em `CSV_MAX_FILE_SIZE_BYTES` |
| `next` | Pin range `^15.5.21` | Alinha landing ao patch recente |

## Exceções temporárias (toolchain)

| Pacote | Severidade | Cadeia | Risco residual | Dono | Expira |
|--------|------------|--------|----------------|------|--------|
| `brace-expansion` | high | ESLint 8 / Nest CLI / webpack (dev) | DoS em tooling local/CI de lint — **não** entra na imagem runtime da API/web | platform | **2026-10-01** |

Plano de remoção: migrar ESLint 8 → 9 e atualizar `@nestjs/cli` quando o monorepo permitir; reexecutar `pnpm audit` e apagar a linha.

## Critério para nova exceção

Só adicionar high sem falhar o CI quando:

1. o pacote é **devDependency / toolchain** (não entra no bundle/imagem de produção), **e**
2. não existe patch sem breaking major, **e**
3. risco residual, dono e **data de expiração** estão nesta tabela.
