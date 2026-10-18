# Migrations de Banco de Dados (Fly.io / Produção)

As migrations **não** rodam quando os processos da API ou do worker iniciam. Os comandos dos processos de produção são:

```text
node dist/main.js    # API
node dist/worker.js  # worker
```

Isso evita condições de corrida quando múltiplas instâncias web ou workers inicializam e garante que a evolução do schema seja um passo anterior ao rollout. Isso não garante atomicidade de toda a sequência de migrations; uma falha pode deixar alterações parciais no banco.

---

## 1. Estratégia: `release_command` no Fly.io (Um escritor por release)

No [`fly.toml`](../../fly.toml), a seção `[deploy]` define:

```toml
[deploy]
  release_command = "./scripts/fly-release.sh"
```

### Comportamento do Release no Fly.io

1. **Execução Pré-Rollout:** Antes de qualquer máquina nova ser criada ou substituída, o Fly inicia uma VM temporária e efêmera baseada na imagem recém-construída.
2. **Execução do Script:** A VM executa [`apps/api/scripts/fly-release.sh`](../../apps/api/scripts/fly-release.sh).
3. **Prisma CLI Embutido:** O Dockerfile da API embute o Prisma CLI e os arquivos de migração (`apps/api/prisma/migrations`) na imagem final de produção. Nenhuma ferramenta é baixada em tempo de release.
4. **Tratamento de Falhas (Abort Automático):** Se o script falhar (código de saída diferente de 0), o deploy é **cancelado imediatamente**, o rollout do código novo não prossegue. O banco pode já ter sido alterado por migrations anteriores ou parcialmente executadas; valide a compatibilidade com a versão ainda em execução.
5. **No-op Seguro:** Se não houver migrations pendentes, o comando executa rapidamente sem alterações e o rollout prossegue.

---

## 2. Segregação de Privilégios: Owner vs Papel RLS (`prospectly_app`)

O Prospectly utiliza Row-Level Security (RLS) multi-tenant no PostgreSQL:

| Papel                      | Finalidade                                 | Permissões                                                     | Variável de Ambiente     |
| -------------------------- | ------------------------------------------ | -------------------------------------------------------------- | ------------------------ |
| **Owner (`postgres`)**     | Execução de migrations (`release_command`) | DDL completo, `BYPASSRLS`                                      | `MIGRATION_DATABASE_URL` |
| **App (`prospectly_app`)** | Runtime da API e Worker                    | `rolbypassrls=false`, `rolsuper=false`, isolamento RLS estrito | `DATABASE_APP_URL`       |

### Script de Release ([`apps/api/scripts/fly-release.sh`](../../apps/api/scripts/fly-release.sh))

O script valida que `MIGRATION_DATABASE_URL` está preenchida, mapeia-a dinamicamente para `DATABASE_URL` somente dentro do processo de release efêmero e executa `prisma migrate deploy`:

```sh
#!/bin/sh
set -eu

echo "==> [Fly.io Release] Starting database migrations..."

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  echo "ERROR: MIGRATION_DATABASE_URL is not set. Migrations require the owner database connection string." >&2
  exit 1
fi

export DATABASE_URL="$MIGRATION_DATABASE_URL"
unset MIGRATION_DATABASE_URL

# Trecho para o layout da imagem (/app); o script real também aceita a raiz do repo
prisma migrate deploy --schema="./prisma/schema.prisma"
```

### Provisionamento da Role `prospectly_app`

As migrations criam a role `prospectly_app` com `NOLOGIN`, sem senha e sem `BYPASSRLS`. Uma única vez durante a configuração inicial do ambiente, o operador provisiona a senha diretamente no console SQL do banco:

```sql
ALTER ROLE prospectly_app LOGIN PASSWORD '<SENHA_SEGURA>';
```

> [!CAUTION]
> Nunca use a conexão de owner (`postgres`) no runtime da aplicação. Em produção e staging, o boot da API e do Worker falha deliberadamente se `DATABASE_APP_URL` estiver ausente ou vazia.

---

## 3. Ordem Efetiva de um Release

1. **Merge em `main`:** CI verde valida testes, lint, typecheck e auditoria.
2. **Build da Imagem:** Fly compila a imagem Docker compartilhada a partir de `apps/api/Dockerfile`.
3. **Release Command:** Fly sobe a VM efêmera e roda `./scripts/fly-release.sh` contra o PostgreSQL via Flycast (`prospectly-db.flycast:5432`).
4. **Deploy das Máquinas:** Se o release command retornar exit 0:
   - A máquina de API (`app`) é iniciada com `ROLE=api`.
   - A máquina de Worker (`worker`) é iniciada com `ROLE=worker`.
5. **Gate de Readiness:** O endpoint `GET /health/ready` valida conectividade com o banco antes do Fly direcionar tráfego para a nova máquina da API.

---

## 4. Estratégia de Migração: Expand / Contract

Para garantir que a versão em execução e a nova versão coexistam durante o rollout:

1. **Expand (Aditivo):** Novas colunas devem ser opcionais (`nullable`) ou ter valores default seguros; novas tabelas ou índices.
2. **Migração de Dados (se aplicável):** Scripts idempotentes de backfill executados em lote controlado.
3. **Contract (Destrutivo/Remoção):** Remoção de colunas ou tabelas antigas apenas em release subsequente, após todas as instâncias estarem rodando código que não as referencia mais.

---

## 5. Rollback

| Cenário                                    | Ação                                                                                                                                                            |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Falha no `release_command`                 | O Fly aborta automaticamente o deploy. A versão anterior continua no ar servindo tráfego. Corrija a migration e submeta novo release.                           |
| Problema no código novo, migration aditiva | Execute rollback para a imagem anterior: `fly deploy --image <imagem_anterior>`. O código anterior continua compatível com schema aditivo.                      |
| Migração destrutiva com problema           | Restaure o banco a partir do backup ou snapshot point-in-time anterior ao release e reverta a imagem. Evite down-migrations em produção sem homologação prévia. |

---

## 6. Contingência: Execução Local/Manual

Caso seja necessário inspecionar o status das migrations ou aplicá-las manualmente via linha de comando externa autenticada:

```bash
# Verificar status das migrations pendentes
DATABASE_URL="postgresql://postgres:<secret>@<host-ou-proxy>:5432/prospectly" \
  pnpm --filter @prospectly/api exec prisma migrate status

# Aplicar migrations
DATABASE_URL="postgresql://postgres:<secret>@<host-ou-proxy>:5432/prospectly" \
  pnpm --filter @prospectly/api exec prisma migrate deploy
```

---

## Relacionados

- Deploy geral no Fly.io: [`docs/deploy/fly.md`](./fly.md)
- Operação do worker BullMQ: [`docs/deploy/workers.md`](./workers.md)
- Dockerfile de produção: [`apps/api/Dockerfile`](../../apps/api/Dockerfile)
- Script de release: [`apps/api/scripts/fly-release.sh`](../../apps/api/scripts/fly-release.sh)
