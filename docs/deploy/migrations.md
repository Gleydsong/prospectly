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
| `GET /health/ready` | Readiness — **PostgreSQL** (`SELECT 1` via Prisma). Redis **não** entra no gate: a API precisa permanecer apta a receber webhooks Asaas |

A Render usa `healthCheckPath: /health/ready`. Não marque uma revisão nova como viva até o readiness passar depois das migrations (quando o release inclui mudança de schema).

## Estratégia: Pre-Deploy Command na API (um escritor por release)

**Regra:** exatamente um passo executa `prisma migrate deploy` por release contra o banco alvo. Nunca rode migrate em toda réplica web no start nem no worker.

Em produção esse passo é o **Pre-Deploy Command** do serviço Node live `prospectly-api` na Render:

```text
pnpm --filter @prospectly/api exec prisma migrate deploy
```

Comportamento da Render: roda **depois do build e antes de a revisão nova ir ao ar**, numa instância separada, com as env vars do serviço (`DATABASE_URL` = owner / `BYPASSRLS`, via rede privada — sem alterar allow list). Se o comando falhar, o deploy é cancelado e a revisão anterior continua servindo. Migrations já aplicadas são no-op, portanto releases sem mudança de schema não precisam de nada especial. Disponível só em instâncias pagas (a API é `0.5c-512mb`).

Ordem efetiva de um release com mudança de schema:

1. Merge em `main` com CI verde (`autoDeployTrigger: checksPass`).
2. Render faz o build da API.
3. Pre-Deploy: `prisma migrate deploy` (uma execução, owner).
4. A revisão nova da API sobe; `GET /health/ready` fecha o gate.

Pré-requisitos de RLS (uma vez por ambiente, fora das migrations): provisionar `prospectly_app` com `LOGIN` e um segredo forte do gerenciador de secrets da plataforma (a migration cria o role como `NOLOGIN`, sem senha e sem `BYPASSRLS`) e definir `DATABASE_APP_URL` com essa credencial. Nunca commitar ou embutir a senha em migration, imagem, histórico de comando ou arquivo de ambiente do repo. Runtime usa `DATABASE_APP_URL` e cai para `DATABASE_URL`.

### Worker e ordem de deploy

`prospectly-worker` deploya o mesmo commit em paralelo e **não** roda migrate. Pode ir ao ar segundos antes do pre-deploy da API terminar. Com migrations **expand** (aditivas) isso é inofensivo; escritas em coluna ainda inexistente falham e o BullMQ faz retry / os reconciliadores reenfileiram. Se um release depender de schema novo no worker de forma não tolerante a retry, pause o auto-deploy do worker, deixe a API sair, e depois redeploye o worker.

### Ligar / verificar (operação dirigida)

A API live não é gerida por sync de Blueprint (ver aviso no topo de `render.yaml`). Configure via script idempotente, com uma API key da Render **fora** do repo:

```bash
RENDER_API_KEY=... node scripts/render-set-predeploy.cjs           # dry-run: mostra atual vs alvo
RENDER_API_KEY=... node scripts/render-set-predeploy.cjs --apply   # PATCH + verificação
```

O script recusa runtime não-Node (o runner Docker não embarca Prisma CLI) e plano free, e reenvia `buildCommand`/`startCommand` inalterados. Equivalente no Dashboard: `prospectly-api` → Settings → Build & Deploy → **Pre-Deploy Command**. A alteração vale a partir do próximo deploy. Confirme no log do deploy a etapa *Pre-deploy* com `N migrations found` / `No pending migrations`.

O provisionamento do role fica de propósito fora das migrations Prisma para a senha nunca ir para o controle de versão. Execute o equivalente a `ALTER ROLE prospectly_app LOGIN PASSWORD <secret>` no console SQL protegido do provedor ou num job de release que leia a senha direto do secret manager.

### One-off local (contingência)

Só se o pre-deploy estiver desligado ou for preciso aplicar fora de um deploy. Render exige TLS na URL externa:

```bash
# Na raiz do repo; DATABASE_URL externa de produção (owner) com sslmode=require
DATABASE_URL="postgresql://...?sslmode=require" pnpm --filter @prospectly/api exec prisma migrate status
DATABASE_URL="postgresql://...?sslmode=require" pnpm --filter @prospectly/api exec prisma migrate deploy
```

`migrate status` sai com código 1 quando há migrations pendentes — é sinalização, não erro.

### Target Docker `migrate` (opcional)

O Dockerfile define o estágio nomeado `migrate` (deps de produção + Prisma CLI + arquivos de migration):

```bash
docker build -f apps/api/Dockerfile --target migrate -t prospectly-api-migrate .
docker run --rm -e DATABASE_URL="$DATABASE_URL" prospectly-api-migrate
```

Use isso num orquestrador que rode uma tarefa única antes de rolar a web (corte Docker futuro). Num serviço Docker da Render o `preDeployCommand` roda dentro da imagem do serviço, e o runner **não** embarca o Prisma CLI — nesse cenário o pre-deploy teria de ser revisto junto com o Dockerfile.

## Expand / contract (compatibilidade)

Prefira **expand/contract** para versões antiga e nova do app coexistirem no rollout:

1. **Expand** — migration aditiva e retrocompatível (colunas nullable novas, tabelas novas, índices novos). Rode o job de migrate e depois o código que lê/escreve os dois formatos, se preciso.
2. **Migrar dados** — backfill num job controlado, se necessário (idempotente).
3. **Contract** — remover colunas/tabelas obsoletas só depois que todas as instâncias rodarem código que não depende mais delas (em geral um release posterior).

Evite expand+contract no mesmo release quando as instâncias sobem aos poucos. Renomes quebradores devem ser fatiados (adicionar novo → dual-write/read → dropar o antigo).

## Rollout

1. Merge em `main` depois do CI verde (`autoDeployTrigger: checksPass` na Render).
2. Acompanhe o deploy da API: a etapa *Pre-deploy* deve terminar com exit code 0 (`prisma migrate deploy`). Se falhar, o deploy é cancelado — corrija a migration e faça novo merge; a revisão anterior segue no ar.
3. A revisão nova sobe (`node apps/api/dist/main.js`).
4. Verifique `GET /health/ready` (Postgres) e um caminho de smoke (login / uma leitura autenticada). Redis down não deve impedir o ready.

## Rollback

| Situação | Ação |
|-----------|--------|
| App novo ruim, **sem** migrate no release | Redeploy da imagem/revisão anterior da API. |
| App novo ruim, migrate só **expand** (aditivo) | Redeploy da imagem anterior. O código antigo em geral ainda funciona com colunas/tabelas extras. Agende um contract depois, se preciso. |
| App novo ruim, migrate **destrutivo** / incompatível | **Não** confie em down migrations automáticas em produção. Restaure o DB a partir do snapshot/backup de antes do migrate e redeploy da imagem anterior. Prefira não fazer migration destrutiva sem caminho de restore testado. |

Sempre confirme que há backup/point-in-time recovery do DB antes de um release com migration não aditiva. Como o pre-deploy roda automaticamente, migrations destrutivas exigem planejamento **antes** do merge (snapshot manual, janela, restore testado).

Para desligar o passo automático (ex.: durante uma janela manual): `node scripts/render-set-predeploy.cjs --clear --apply`.

## Alternativas descartadas

- **Job de Blueprint (`type: job`)** — sincronizar o `render.yaml` converteria recursos live free em pagos (ver aviso no topo do arquivo) e jobs de Blueprint não escolhem build target Docker; o runner não tem Prisma CLI.
- **Passo de CI no GitHub Actions** — exigiria expor `DATABASE_URL` externa como secret do GitHub e abrir a allow list do Postgres para os IPs dos runners. O pre-deploy roda na rede privada da Render sem nada disso.

## Relacionados

- Visão do Blueprint: [`docs/deploy/render.md`](./render.md)
- Worker BullMQ (não roda migrate): [`docs/deploy/workers.md`](./workers.md)
- Script do Pre-Deploy Command: `scripts/render-set-predeploy.cjs`
- Dockerfile da API: `apps/api/Dockerfile`
- Implementação de health: `apps/api/src/common/health/health.controller.ts`
