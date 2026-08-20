# Dependências — exceções e política de audit

Atualizado: **2026-08-20**.

## Política de CI

| Nível | Comportamento |
|-------|----------------|
| **critical** | Bloqueia (`pnpm audit --audit-level=critical`) |
| **high** | Bloqueia (`pnpm audit --audit-level=high`) — sem `continue-on-error` |
| **high (runtime)** | Também validado por `node scripts/audit-runtime.cjs` |
| moderate/low | Monitorado |

## Remediações aplicadas

| Pacote | Ação | Advisory / cadeia | Remover override quando |
|--------|------|-------------------|-------------------------|
| `multer` | `pnpm.overrides` `^2.2.0` | GHSA-xf7r-hgr6-v32p, GHSA-v52c-386h-88mc, GHSA-5528-5vmv-3xc2, GHSA-72gw-mp4g-v24j — via `@nestjs/platform-express` | Nest pinar multer ≥2.2.0 |
| `sharp` | `pnpm.overrides` `>=0.35.0` | GHSA-f88m-g3jw-g9cj — via `next` (landing) | Next depender de sharp ≥0.35.0 |
| `lodash` | `pnpm.overrides` `>=4.18.0` | GHSA-r5fr-rjxr-66jc — via `@nestjs/config` | `@nestjs/config` pinar lodash ≥4.18.0 |
| `js-yaml` (v3) | `pnpm.overrides` `js-yaml@>=3 <4` → `3.15.1` | GHSA-5p4m-2wfm-xmqj (CVE-2026-59870) — via Jest / istanbul | Istanbul/Jest pinar js-yaml ≥3.15.1 |
| `js-yaml` (v4) | `pnpm.overrides` `js-yaml@>=4 <5` → `4.3.1` | GHSA-5p4m-2wfm-xmqj + GHSA-52cp-r559-cp3m — via `@nestjs/swagger`, commitlint | Swagger/cosmiconfig pinar js-yaml ≥4.3.1 |
| `glob` (v10) | `pnpm.overrides` `glob@>=10.2.0 <11` → `>=10.5.0` | GHSA-5j98-mcp5-4vw2 — via `@nestjs/cli` (toolchain) | Nest CLI pinar glob ≥10.5.0 |
| `picomatch` (v4) | `pnpm.overrides` `picomatch@>=4 <4.0.4` → `>=4.0.4` | GHSA-c2c7-rcm5-vvqj — via Nest CLI / angular-devkit | Devkit pinar picomatch ≥4.0.4 |
| `tmp` | `pnpm.overrides` `>=0.2.6` | GHSA-ph9p-34f9-6g65 — via Nest CLI / inquirer | external-editor pinar tmp ≥0.2.6 |
| `postcss` | `pnpm.overrides` `>=8.5.18` | GHSA-r28c-9q8g-f849 — transitiva via Next | Next pinar postcss seguro |
| `deepmerge-ts` | `pnpm.overrides` `8.0.0` | GHSA-ggr8-5vv4-36mx — via `prisma` / `@prisma/config` | Prisma pinar `deepmerge-ts` ≥8 |
| `brace-expansion` | overrides por major | tooling (eslint/nest-cli) | ESLint 9 / Nest CLI atualizado |
| `react-router` / `react-router-dom` | Direto `^7.18.2` + `auditConfig.ignoreGhsas` | Ver seção abaixo | Quando o advisory DB do npm listar `>=7.18.2` como patched **ou** existir `react-router-dom@8` compatível com React 18 SPA |

## React Router (`GHSA-qwww-vcr4-c8h2`)

- Advisory **oficial** (GitHub): patched `>=7.18.2` e `>=8.3.0`; afeta **somente** APIs RSC instáveis.
- App web é **SPA Vite** com `BrowserRouter` — **não** usa RSC / React Server Components.
- `react-router-dom@8` **não existe** no npm; `react-router@8.3.0` exige React `>=19.2.7`.
- O DB de audit do npm ainda reporta `7.12.0–8.2.x` como vulnerável (falso positivo para quem já está em `7.18.2` sem RSC). Ver [issue upstream](https://github.com/remix-run/react-router/issues/15348).
- Mitigação: manter `react-router-dom@^7.18.2` e `pnpm.auditConfig.ignoreGhsas: ["GHSA-qwww-vcr4-c8h2"]` até o advisory DB corrigir **ou** haver linha 8.x utilizável sem migrar para React 19/RSC.

## Exceções temporárias (toolchain)

Nenhuma high toolchain fica sem remediação no lockfile. Overrides acima cobrem as cadeias Nest CLI / Next.

## Critério para nova exceção / ignoreGhsas

Só adicionar GHSA em `ignoreGhsas` quando:

1. o advisory oficial já considera a versão instalada **patched**, **ou** o vetor não se aplica ao produto (ex.: RSC em SPA), **e**
2. não há upgrade direto seguro sem breaking major incompatível, **e**
3. risco residual, dono e condição de remoção estão documentados aqui.
