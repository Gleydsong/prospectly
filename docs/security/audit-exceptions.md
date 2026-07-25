# Dependências — exceções temporárias de `pnpm audit`

Atualizado: 2026-07-25 (Fase 2 hardening).

## Política de CI

| Nível | Comportamento no CI |
|-------|---------------------|
| **critical** | **Bloqueia** o pipeline (`pnpm audit --audit-level=critical`) |
| **high** | Reportado no CI (`continue-on-error: true`) até mitigação na Fase 4 |
| moderate/low | Monitorado localmente |

## Estado atual

`pnpm audit --audit-level=high` reporta **16 high** (principalmente toolchain: ESLint 8, Nest CLI / webpack, PostCSS via Next).

Não há **critical** no momento.

## Plano de mitigação (Fase 4)

1. Atualizar `next` / `postcss` na landing quando patch disponível sem breaking.
2. Avaliar `pnpm overrides` para `brace-expansion` / `minimatch` em cadeias de devDependencies.
3. Migrar ESLint 8 → 9 no monorepo quando o restante do stack permitir.
4. Reavaliar e **remover** `continue-on-error` do step high assim que highs de runtime estiverem zerados.

## Critério para exceção

Só manter high sem falhar o CI quando:

- o pacote é **devDependency / toolchain** (não entra no bundle de produção), **ou**
- não existe patch sem breaking major, **e**
- o risco residual está documentado aqui.
