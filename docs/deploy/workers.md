# Workers BullMQ no Fly.io

No Prospectly, o processo de API HTTP e o processo de Worker BullMQ são completamente separados. O PostgreSQL é a fonte canônica da verdade; o Redis e o BullMQ funcionam como mecanismo de transporte assíncrono e recuperável.

Referência arquitetural: ADR [`docs/adr/0006-separate-bullmq-worker.md`](../adr/0006-separate-bullmq-worker.md).

---

## 1. Segregação de Papéis e Processos

A aplicação divide responsabilidades de acordo com a variável de ambiente `ROLE`:

| Papel      | Entrypoint e Comando Fly              | Módulo Principal                         | Responsabilidades                                                                                                                                                    |
| ---------- | ------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API**    | `env ROLE=api node dist/main.js`      | `AppModule`                              | Servidor HTTP NestJS (Express), autenticação, endpoints REST, produtores de fila (`queue.add`), reconciliadores de dispatch e webhooks Asaas. **Zero `@Processor`**. |
| **Worker** | `env ROLE=worker node dist/worker.js` | `WorkerModule` (importa `WorkersModule`) | Application context NestJS **sem listener HTTP**. Consumo das filas BullMQ, processamento assíncrono e agendamentos. **Zero HTTP, zero migrations**.                 |

### Validação de Ambiente por Papel (`validateEnv`)

A inicialização valida as variáveis estritamente necessárias para o papel:

- **API (`ROLE=api`):** Em produção/staging, exige `DATABASE_APP_URL`, `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`; com Asaas habilitado, exige `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`. `CORS_ORIGINS` e a configuração Google devem ser preenchidos para suas funcionalidades, mas não são obrigatórios em `validateEnv`.
- **Worker (`ROLE=worker`):** Em produção/staging, exige `DATABASE_APP_URL` e `REDIS_URL`. **Não** exige secrets de JWT, cookie ou controllers da API.

---

## 2. Processors Registrados no `WorkersModule`

O `WorkersModule` concentra todos os consumidores de tarefas em segundo plano. O sistema conta com **8 processors dedicados mais o `GmailSyncScheduler`**:

1. **`ProspectingProcessor`:** Execução assíncrona de buscas locais (OpenStreetMap Nominatim/Overpass e Google Places) e enriquecimento preliminar de leads.
2. **`ImportsProcessor`:** Ingestão de arquivos CSV em staging, validação linha a linha, deduplicação e carga no banco de dados.
3. **`ScoringProcessor`:** Cálculo de pontuações de oportunidade para leads com base nos pesos definidos pela organização.
4. **`WebsiteAnalysisProcessor`:** Auditoria técnica de sites (detecção de CMS/framework, SEO on-page, performance e segurança SSRF).
5. **`OpportunityFinderProcessor`:** Varredura proativa de nichos e regiões para prospecção automatizada.
6. **`RetentionProcessor`:** Execução periódica da política de retenção de dados e expiração de logs/eventos (LGPD).
7. **`OutboxProcessor`:** Processamento da fila de eventos de domínio (`OutboxEvent`) para disparar workflows e notificações.
8. **`GmailIngestProcessor`:** Sincronização e ingestão assíncrona de e-mails da Conexão Google com correspondência de leads.
9. **`GmailSyncScheduler`:** Agendador periódico que distribui jobs de sincronização incremental para contas Google ativas.

> [!NOTE]
> O `AppModule` **não importa** o `WorkersModule`. O servidor HTTP apenas enfileira jobs; nenhum processor é instanciado na API.

---

## 3. Dimensionamento e Execução no Fly.io

No [`fly.toml`](../../fly.toml), os processos são declarados sob `[processes]`:

```toml
[processes]
  app = "env ROLE=api node dist/main.js"
  worker = "env ROLE=worker node dist/worker.js"
```

### Escalonamento de Instâncias

O worker deve ser escalado como uma máquina dedicada na mesma região do banco e da API:

```bash
fly scale count app=1 worker=1 --region gru
```

- **Por que `worker=1`?**
  A existência de uma única instância de worker em produção previne que schedulers em memória (como o `GmailSyncScheduler`) sejam disparados em duplicidade.
- **Sem Autostop:**
  O worker opera continuamente e não escuta portas de rede, permanecendo ativo para drenar jobs a qualquer momento.

---

## 4. Pool de Conexões do PostgreSQL e Redis

Para evitar exaustão de conexões no banco de dados (erro Prisma `P2028`), o `PrismaService` define limites automáticos conforme o `ROLE`:

| Processo          | `ROLE`   | `connection_limit` | `pool_timeout` |
| ----------------- | -------- | ------------------ | -------------- |
| **API HTTP**      | `api`    | 5                  | 10s            |
| **Worker BullMQ** | `worker` | 3                  | 10s            |

Adicionalmente, o processamento de outbox respeita a concorrência configurada:

- `OUTBOX_WORKER_CONCURRENCY=2`: Garante que rajadas de eventos não monopolizem o pool do worker.

### Configuração do Redis

O Redis roda em máquina Fly privada (`prospectly-redis.flycast:6379`) e **deve** ser configurado com:

- `maxmemory-policy noeviction`: Impede descarte silencioso de jobs pendentes quando a memória atinge o limite.
- Persistência AOF (Append-Only File): Garante durabilidade dos jobs enfileirados em caso de reinício.

---

## 5. Encerramento Gracioso (Graceful Shutdown)

Ao receber sinais de terminação do sistema operacional (`SIGTERM` ou `SIGINT`):

1. O worker encerra a ingestão de novos jobs das filas via `app.close()`.
2. Aguarda a conclusão dos jobs em andamento até o tempo limite definido por `WORKER_SHUTDOWN_TIMEOUT_MS` (padrão: `30000` ms / 30 segundos).
3. Fecha conexões com o Redis e o PostgreSQL de maneira ordenada.
4. Emite log de encerramento completo: `Worker shutdown complete`.

---

## 6. Desenvolvimento Local

Para executar os processos em ambiente de desenvolvimento:

```bash
# Executa API e Worker simultaneamente via scripts/dev-with-worker.mjs
pnpm --filter @prospectly/api run dev

# Ou em terminais separados:
pnpm --filter @prospectly/api run dev:api     # Somente API HTTP (ROLE=api)
pnpm --filter @prospectly/api run dev:worker  # Somente Worker BullMQ (ROLE=worker)
```

---

## Relacionados

- Deploy geral no Fly.io: [`docs/deploy/fly.md`](./fly.md)
- Migrations e segregação de roles: [`docs/deploy/migrations.md`](./migrations.md)
- Módulo dos workers: [`apps/api/src/modules/workers/workers.module.ts`](../../apps/api/src/modules/workers/workers.module.ts)
