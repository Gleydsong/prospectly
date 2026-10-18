# Deploy do Prospectly no Fly.io (API e Worker)

Configuração de infraestrutura do backend no Fly.io: API NestJS (`ROLE=api`), worker BullMQ (`ROLE=worker`), cluster PostgreSQL e instância Redis com persistência.

Configuração declarada em [`fly.toml`](../../fly.toml), imagem compartilhada em [`apps/api/Dockerfile`](../../apps/api/Dockerfile) e script de release em [`apps/api/scripts/fly-release.sh`](../../apps/api/scripts/fly-release.sh). Região padrão: **`gru`** (São Paulo).

---

## 1. Topologia e Recursos no Fly.io

| Recurso               | Identificador                         | Papel e Configuração                                                                                                                                                          |
| --------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App Fly**           | `prospectly-api`                      | Aplicação Fly única abrigando os processos `app` e `worker` na mesma região (`gru`).                                                                                          |
| **Processo `app`**    | `env ROLE=api node dist/main.js`      | API HTTP NestJS. Porta interna 3000 mapeada para 80/443 com terminação TLS pública. Não executa migrations no boot. Zero `@Processor`.                                        |
| **Processo `worker`** | `env ROLE=worker node dist/worker.js` | Worker BullMQ em processo dedicado. Sem listener HTTP, sem portas expostas, sem autostop. Consome as 8 filas do sistema mais o `GmailSyncScheduler`.                          |
| **Fly Postgres**      | `prospectly-db`                       | Cluster PostgreSQL autogerido acessível via rede privada Flycast (`prospectly-db.flycast:5432`).                                                                              |
| **Redis**             | `prospectly-redis`                    | Máquina Redis dedicada para BullMQ e rate limiting distribuído, acessível via Flycast (`prospectly-redis.flycast:6379`), configurada com `maxmemory-policy noeviction` e AOF. |
| **Release Command**   | `./scripts/fly-release.sh`            | VM efêmera executada uma vez por deploy antes das novas máquinas subirem. Aplica migrations Prisma (`MIGRATION_DATABASE_URL`).                                                |

---

## 2. Processos e Dimensionamento

No `fly.toml`:

```toml
[processes]
  app = "env ROLE=api node dist/main.js"
  worker = "env ROLE=worker node dist/worker.js"

[http_service]
  processes = ["app"]
  internal_port = 3000
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    interval = "15s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/health/ready"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

### Escalonamento de Máquinas

Para garantir execução de schedulers sem duplicação e evitar criação de máquinas redundantes no lançamento:

```bash
# Primeiro deploy sem redundância automática
fly deploy --ha=false

# Dimensionar exatamente 1 máquina de API e 1 máquina de worker na região gru
fly scale count app=1 worker=1 --region gru
```

O processo `worker` não possui `http_service` associado e opera continuamente com `auto_stop_machines = "off"`.

---

## 3. Variáveis de Ambiente e Secrets

### Variáveis Públicas (`[env]` no `fly.toml`)

| Variável                     | Valor Configurado / Default                                       | Descrição                                                |
| ---------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------- |
| `PORT`                       | `3000`                                                            | Porta interna HTTP do NestJS                             |
| `NODE_ENV`                   | `production`                                                      | Ambiente de execução                                     |
| `JWT_ACCESS_EXPIRES_IN`      | `15m`                                                             | Validade do token JWT de acesso                          |
| `JWT_REFRESH_EXPIRES_IN`     | `7d`                                                              | Validade do token JWT de refresh                         |
| `REFRESH_COOKIE_SAME_SITE`   | `lax`                                                             | Cookie host-only da API; chamadas do app são same-site   |
| `FRONTEND_URL`               | `https://app.prospectlyonboard.com`                               | URL do frontend SPA                                      |
| `CORS_ORIGINS`               | `https://app.prospectlyonboard.com,https://prospectlyonboard.com` | Origens CORS autorizadas                                 |
| `ASAAS_ENABLED`              | `true`                                                            | Ativação do gateway de pagamento Asaas                   |
| `PIX_PROVIDER`               | `ASAAS`                                                           | Provedor de PIX                                          |
| `ASAAS_API_BASE_URL`         | `https://api.asaas.com/v3`                                        | Endpoint de produção do Asaas                            |
| `ASAAS_HTTP_TIMEOUT_MS`      | `15000`                                                           | Timeout das chamadas Asaas (ms)                          |
| `OSM_USER_AGENT`             | `Prospectly/1.0 (https://prospectlyonboard.com)`                  | User-agent obrigatório para OpenStreetMap                |
| `SMTP_PORT`                  | `587`                                                             | Porta SMTP padrão                                        |
| `LOG_LEVEL`                  | `info`                                                            | Nível de log estruturado Pino                            |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | `30000`                                                           | Timeout para encerramento gracioso do worker BullMQ (ms) |
| `OUTBOX_WORKER_CONCURRENCY`  | `2`                                                               | Concorrência do processamento da fila de outbox          |

### Secrets de Produção (`fly secrets set`)

No Fly.io, todas as secrets configuradas em um aplicativo são injetadas em todos os seus processos (`app` e `worker`). O runtime seleciona `DATABASE_APP_URL`, mas isso não isola as credenciais: API e worker também recebem `MIGRATION_DATABASE_URL`. O `unset` no script afeta apenas o processo de release; uma máquina comprometida ainda pode acessar a credencial owner. Isolamento de secrets entre release e runtime exige uma mudança de infraestrutura fora deste guia.

| Secret                        | Obrigatório para                   | Descrição e Requisitos                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MIGRATION_DATABASE_URL`      | Release Command (`fly-release.sh`) | URL de conexão PostgreSQL com credenciais de **owner** (`postgres`, com `BYPASSRLS`). Consumida pelo script de release para `prisma migrate deploy`; também exposta ao ambiente das máquinas de runtime (ver ressalva acima). Formato: `postgresql://postgres:<secret>@prospectly-db.flycast:5432/prospectly?sslmode=disable` |
| `DATABASE_APP_URL`            | API & Worker                       | URL de conexão PostgreSQL com papel restrito **`prospectly_app`** (sem `BYPASSRLS`, RLS ativo). Obrigatória em produção/staging para ambos os processos. Formato: `postgresql://prospectly_app:<secret>@prospectly-db.flycast:5432/prospectly?sslmode=disable`                                                                |
| `REDIS_URL`                   | API & Worker                       | Conexão com Redis BullMQ Fly (`noeviction`). Formato: `redis://default:<secret>@prospectly-redis.flycast:6379`                                                                                                                                                                                                                |
| `JWT_ACCESS_SECRET`           | API                                | Chave com ≥ 32 caracteres e alta entropia para assinatura de tokens de acesso                                                                                                                                                                                                                                                 |
| `JWT_REFRESH_SECRET`          | API                                | Chave com ≥ 32 caracteres e alta entropia para assinatura de tokens de refresh                                                                                                                                                                                                                                                |
| `ASAAS_API_KEY`               | API                                | Chave de API de produção do Asaas (`$aact_prod_...`)                                                                                                                                                                                                                                                                          |
| `ASAAS_WEBHOOK_TOKEN`         | API                                | Token de autenticação dos webhooks recebidos do Asaas                                                                                                                                                                                                                                                                         |
| `GOOGLE_PLACES_API_KEY`       | API & Worker                       | Chave de API do Google Places para busca/enriquecimento de leads                                                                                                                                                                                                                                                              |
| `GOOGLE_CLIENT_ID`            | API                                | Client ID para autenticação Google OAuth                                                                                                                                                                                                                                                                                      |
| `GOOGLE_CLIENT_SECRET`        | API                                | Client Secret para autenticação Google OAuth                                                                                                                                                                                                                                                                                  |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | API                                | Chave de 64 caracteres hexadecimais (32 bytes) para criptografia AES de tokens OAuth                                                                                                                                                                                                                                          |
| `RESEND_API_KEY`              | API                                | Chave da API Resend (`re_...`) para envio de e-mails transacionais                                                                                                                                                                                                                                                            |
| `OPS_METRICS_TOKEN`           | API                                | Token de autorização para `GET /api/v1/ops/metrics` (mínimo 32 caracteres)                                                                                                                                                                                                                                                    |
| `SENTRY_DSN`                  | API & Worker                       | DSN do Sentry para monitoramento e telemetria de erros (opcional)                                                                                                                                                                                                                                                             |

> [!IMPORTANT]
> `DATABASE_URL` **não** deve ser configurada como secret persistente do app no Fly. O runtime exige `DATABASE_APP_URL` (`prospectly_app`), que nunca possui `BYPASSRLS`. A secret `MIGRATION_DATABASE_URL` é mapeada dinamicamente para `DATABASE_URL` apenas dentro do script `./scripts/fly-release.sh`.

---

## 4. Passo a Passo de Provisionamento e Deploy

### 1. Criar o aplicativo no Fly.io

```bash
fly apps create prospectly-api
```

### 2. Criar o cluster PostgreSQL e o banco

```bash
fly postgres create --name prospectly-db --region gru --initial-cluster-size 1 --vm-size shared-cpu-1x
# Não usar fly postgres attach: ele criaria DATABASE_URL persistente no app.
# Criar o banco prospectly com a conexão owner no console SQL antes das migrations.
```

### 3. Provisionar a role restrita `prospectly_app`

Antes do primeiro boot, aplique as migrations com a conexão owner usando o procedimento manual em [migrations.md](./migrations.md#6-contingência-execução-localmanual), por um proxy autenticado para o banco privado. Isso cria a role inicialmente NOLOGIN. Só então, no console SQL do cluster Postgres:

```sql
-- Criar senha segura para a role prospectly_app (criada como NOLOGIN pelas migrations)
ALTER ROLE prospectly_app LOGIN PASSWORD '<SENHA_FORTE_GERADA>';

-- Confirmar ausência de superusuário e bypass de RLS:
SELECT rolname, rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname = 'prospectly_app';
-- Esperado: rolsuper=false, rolbypassrls=false, rolcanlogin=true
```

### 4. Criar a instância Redis

O repositório não contém um descritor de infraestrutura Redis. O operador deve provisionar uma máquina Fly privada chamada `prospectly-redis`, na região `gru`, com volume persistente montado para os dados Redis, autenticação, AOF (`appendonly yes`), `maxmemory-policy noeviction` e serviço TCP privado via Flycast na porta 6379. Verifique esses requisitos antes de preencher `REDIS_URL`.

`fly redis create` provisiona [Upstash](https://fly.io/docs/flyctl/redis-create/), e não essa máquina privada com volume; não é o procedimento para a topologia definida aqui. Provisionamento e smoke reais permanecem no gate humano da issue #338.

### 5. Configurar secrets da aplicação

O `fly.toml` versionado aponta para o endpoint financeiro de produção Asaas. Isso descreve a configuração entregue, não autoriza transações reais: a ativação exige autorização humana e smoke. Para homologação, use ambiente separado com URL e chave Sandbox compatíveis; nunca misture chave de um ambiente com URL de outro.

```bash
fly secrets set \
  MIGRATION_DATABASE_URL="postgresql://postgres:<SENHA_OWNER>@prospectly-db.flycast:5432/prospectly?sslmode=disable" \
  DATABASE_APP_URL="postgresql://prospectly_app:<SENHA_APP>@prospectly-db.flycast:5432/prospectly?sslmode=disable" \
  REDIS_URL="redis://default:<SENHA_REDIS>@prospectly-redis.flycast:6379" \
  JWT_ACCESS_SECRET="<GERAR_SECRET_MIN_32_CHARS>" \
  JWT_REFRESH_SECRET="<GERAR_SECRET_MIN_32_CHARS>" \
  ASAAS_API_KEY='<CHAVE_ASAAS_PRODUCAO>' \
  ASAAS_WEBHOOK_TOKEN="<GERAR_TOKEN_WEBHOOK>" \
  GOOGLE_PLACES_API_KEY="<GOOGLE_PLACES_KEY>" \
  GOOGLE_CLIENT_ID="<GOOGLE_CLIENT_ID>" \
  GOOGLE_CLIENT_SECRET="<GOOGLE_CLIENT_SECRET>" \
  GOOGLE_OAUTH_REDIRECT_URI="https://api.prospectlyonboard.com/api/v1/google-connections/callback" \
  GOOGLE_TOKEN_ENCRYPTION_KEY="<64_HEX_CHARS>" \
  RESEND_API_KEY="re_<RESEND_KEY>" \
  OPS_METRICS_TOKEN="<GERAR_TOKEN_MIN_32_CHARS>"
```

### 6. Alocar IPs e configurar TLS para domínio próprio

```bash
fly ips allocate-v4
fly ips allocate-v6
fly certs add api.prospectlyonboard.com
```

### 7. Validação estrita de configuração (Gate obrigatório)

Antes do deploy, valide a integridade do arquivo `fly.toml` com o CLI autenticado:

```bash
fly config validate --strict --config fly.toml
```

### 8. Deploy inicial

```bash
fly deploy --ha=false
```

O `release_command` executará as migrations contra o banco novo. Após a conclusão bem-sucedida, escale os processos:

```bash
fly scale count app=1 worker=1 --region gru
```

---

## 5. Health Checks e Observabilidade

- **Readiness Check:** `GET /health/ready`
  Verifica a conectividade com o PostgreSQL (`SELECT 1`).
  O Redis não faz parte do readiness gate para garantir que incidentes temporários de cache/filas não derrubem a recepção de webhooks financeiros do Asaas.
- **Métricas Operacionais:** `GET /api/v1/ops/metrics`
  Exige o cabeçalho `X-Prospectly-Ops-Token: <OPS_METRICS_TOKEN>`. Devolve 404 quando o token não estiver configurado.
- **Logs estruturados:**
  Emitidos via Pino em JSON com redação automática de tokens, credenciais e cookies sensíveis.
  Visualize com:
  ```bash
  fly logs -a prospectly-api
  fly logs -a prospectly-api --process-group worker
  ```

---

## 6. Rollback e Contingência

1. **Reversão de versão da aplicação:**
   ```bash
   fly releases list
   # Fazer deploy do commit ou release anterior
   fly deploy --image <imagem_anterior>
   ```
2. **Migrations aditivas:**
   Seguindo o padrão expand/contract, o código anterior é compatível com colunas e tabelas criadas pela migration. Nunca execute migrations destrutivas sem plano e validação de restore prévio.
3. Consulte [`migrations.md`](./migrations.md) para detalhes de banco e [`workers.md`](./workers.md) para operação do worker BullMQ.
