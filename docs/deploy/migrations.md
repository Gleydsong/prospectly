# Migrations de banco (produção)

As migrations **não** rodam quando o container da API sobe. O `CMD` da imagem de produção é só:

```text
node dist/main.js
```

Ver `apps/api/Dockerfile`. Isso evita corrida quando várias instâncias web iniciam e mantém a mudança de schema como um passo de release explícito, com um único escritor.

## Health checks (já existentes)

A API expõe:

| Caminho | Finalidade |
|------|---------|
| `GET /health` | Processo básico no ar |
| `GET /health/live` | Liveness (processo vivo) |
| `GET /health/ready` | Readiness — **PostgreSQL** (`SELECT 1` via Prisma) **e Redis** (`PING` via cliente de fila BullMQ) |

A Render usa `healthCheckPath: /health/ready`. Não marque uma revisão nova como viva até o readiness passar depois das migrations (quando o release inclui mudança de schema).

## Estratégia: um job de release

**Regra:** exatamente um job (ou um passo de CI) executa `prisma migrate deploy` por release contra o banco alvo. Nunca rode migrate em toda réplica web no start.

Ordem recomendada para um release com mudança de schema:

1. Build e publicação da imagem da API (target runner; estágio default do Dockerfile).
2. Rodar **um** job/comando de migrate contra o `DATABASE_URL` de produção (owner / `BYPASSRLS`).
3. Provisionar `prospectly_app` com `LOGIN` e um segredo forte do gerenciador de secrets da plataforma. A migration cria o role como `NOLOGIN`, sem senha e sem `BYPASSRLS`.
4. Definir `DATABASE_APP_URL` com essa credencial gerenciada fora do repositório. Nunca commitar ou embutir a senha em migration, imagem, histórico de comando ou arquivo de ambiente do repo.
5. Fazer deploy / roll das instâncias web para a nova imagem (runtime usa `DATABASE_APP_URL` e depois cai para `DATABASE_URL`).
6. Confirmar `GET /health/ready` na revisão nova.

Se o release **não** tem mudança de schema, pule o passo 2.

O provisionamento do role fica de propósito fora das migrations Prisma para a senha nunca ir para o controle de versão. Execute o equivalente a `ALTER ROLE prospectly_app LOGIN PASSWORD <secret>` no console SQL protegido do provedor ou num job de release que leia a senha direto do secret manager.

### One-off local / CI

```bash
# Na raiz do repo, com DATABASE_URL de produção no ambiente
pnpm --filter @prospectly/api exec prisma migrate deploy
```

### Target Docker `migrate` (opcional)

O Dockerfile define o estágio nomeado `migrate` (deps de produção + Prisma CLI + arquivos de migration):

```bash
docker build -f apps/api/Dockerfile --target migrate -t prospectly-api-migrate .
docker run --rm -e DATABASE_URL="$DATABASE_URL" prospectly-api-migrate
```

Use isso num job one-off da Render ou em qualquer orquestrador que rode uma tarefa única antes de rolar a web.

## Expand / contract (compatibilidade)

Prefira **expand/contract** para versões antiga e nova do app coexistirem no rollout:

1. **Expand** — migration aditiva e retrocompatível (colunas nullable novas, tabelas novas, índices novos). Rode o job de migrate e depois o código que lê/escreve os dois formatos, se preciso.
2. **Migrar dados** — backfill num job controlado, se necessário (idempotente).
3. **Contract** — remover colunas/tabelas obsoletas só depois que todas as instâncias rodarem código que não depende mais delas (em geral um release posterior).

Evite expand+contract no mesmo release quando as instâncias sobem aos poucos. Renomes quebradores devem ser fatiados (adicionar novo → dual-write/read → dropar o antigo).

## Rollout

1. Merge em `main` depois do CI verde (`autoDeployTrigger: checksPass` na Render).
2. Se houver migrations Prisma no release: rode o job de migrate **único** primeiro; confirme exit code 0.
3. Deixe o serviço da API implantar a imagem nova (`CMD`: só `node dist/main.js`).
4. Verifique `GET /health/ready` (Postgres + Redis) e um caminho de smoke (login / uma leitura autenticada).

## Rollback

| Situação | Ação |
|-----------|--------|
| App novo ruim, **sem** migrate no release | Redeploy da imagem/revisão anterior da API. |
| App novo ruim, migrate só **expand** (aditivo) | Redeploy da imagem anterior. O código antigo em geral ainda funciona com colunas/tabelas extras. Agende um contract depois, se preciso. |
| App novo ruim, migrate **destrutivo** / incompatível | **Não** confie em down migrations automáticas em produção. Restaure o DB a partir do snapshot/backup de antes do migrate e redeploy da imagem anterior. Prefira não fazer migration destrutiva sem caminho de restore testado. |

Sempre tire (ou confirme) um snapshot/backup do DB antes de rodar migrate em produção.

## Job proposto na Render (precisa de aprovação)

Alterar o `render.yaml` para adicionar um job no Blueprint exige aprovação explícita. **Não aplique o trecho abaixo até revisão.** Somente exemplo:

```yaml
# PROPOSTO — não aplicar no render.yaml até aprovação
# Colocar em projects[0].environments[0].services ao lado de prospectly-api
#
# - type: job
#   name: prospectly-migrate
#   runtime: docker
#   region: frankfurt
#   plan: starter
#   branch: main
#   dockerfilePath: ./apps/api/Dockerfile
#   dockerContext: .
#   # Se/quando a Render suportar seleção de build target em jobs de Blueprint:
#   # dockerBuildTarget: migrate
#   # Até lá, prefira CI `prisma migrate deploy` ou imagem buildada com --target migrate.
#   dockerCommand: npx prisma migrate deploy
#   envVars:
#     - key: DATABASE_URL
#       fromDatabase:
#         name: prospectly-db
#         property: connectionString
```

Enquanto o job não for aprovado e ligado, rode migrations num passo controlado de CI/release (ou one-off manual com a imagem `migrate`) **uma vez** antes de rolar o serviço da API.

## Relacionados

- Visão do Blueprint: [`docs/deploy/render.md`](./render.md)
- Dockerfile da API: `apps/api/Dockerfile`
- Implementação de health: `apps/api/src/common/health/health.controller.ts`
