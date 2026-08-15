# Prospectly

Plataforma inteligente para encontrar, analisar e organizar oportunidades comerciais locais.

SaaS B2B para freelancers, desenvolvedores e agências digitais prospectarem negócios locais que precisam de criação, modernização ou manutenção de sites.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Zustand, Lucide, Recharts
- **API:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, JWT (access + refresh rotation), Argon2, Swagger, Pino
- **Infra:** Docker, Docker Compose, PostgreSQL, Redis, GitHub Actions, pnpm workspaces

## Estrutura

```
prospectly/
├── apps/
│   ├── web/                # Front-end React
│   └── api/                # API NestJS
├── packages/
│   ├── shared-types/       # Tipos e enums compartilhados
│   ├── eslint-config/      # Config ESLint compartilhada
│   └── tsconfig/           # tsconfig base
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Requisitos

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose

## Segurança (local)

- Postgres/Redis no `docker-compose` escutam em `127.0.0.1` (não na interface pública).
- Credenciais default (`prospectly`/`prospectly`) são **somente para desenvolvimento local**.
- Em qualquer ambiente compartilhado ou produção: defina senhas fortes via `.env`, não exponha portas de DB/Redis publicamente e use secrets gerenciados.
- JWT secrets devem ter no mínimo **32 caracteres** (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`).

## Setup

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir PostgreSQL e Redis
docker compose up -d

# 3. Configurar variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 4. Rodar migrations e seed
pnpm db:migrate
pnpm db:seed

# 5. Iniciar API e Web em modo dev
pnpm dev
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs

> **Conflito de portas:** se 5432/6379 já estiverem em uso, suba a infra com
> `POSTGRES_PORT=5433 REDIS_PORT=6380 docker compose up -d` e ajuste
> `DATABASE_URL`/`REDIS_URL` em `apps/api/.env`.

## Credenciais de demonstração (seed)

| E-mail                | Senha    | Papel  |
| --------------------- | -------- | ------ |
| demo@prospectly.dev   | Demo123! | OWNER  |
| admin@prospectly.dev  | Demo123! | ADMIN  |
| sales@prospectly.dev  | Demo123! | SALES  |
| viewer@prospectly.dev | Demo123! | VIEWER |

## Comandos

| Comando                               | Descrição                                 |
| ------------------------------------- | ----------------------------------------- |
| `pnpm dev`                            | Inicia web + api HTTP + worker BullMQ     |
| `pnpm build`                          | Build de todos os pacotes                 |
| `pnpm lint`                           | Lint em todos os pacotes                  |
| `pnpm test`                           | Testes em todos os pacotes                |
| `pnpm typecheck`                      | Verificação de tipos                      |
| `pnpm db:migrate`                     | Prisma migrate dev                        |
| `pnpm db:seed`                        | Seed do banco                             |
| `docker compose up -d`                | Sobe PostgreSQL + Redis                   |
| `docker compose --profile ai up -d`   | Sobe Postgres + Redis + Ollama (IA)       |
| `docker compose --profile full up -d` | Sobe stack completa (db, redis, ollama, api, web, worker) |

### Conversion Studio — IA no site do lead

A geração de landing usa Ollama/Llama **dentro** do fluxo da ferramenta: o usuário escolhe o lead e clica **Gerar site do lead**. Não há integração externa na UI.

```bash
# Dev local: infra + Ollama
docker compose --profile ai up -d
docker compose exec ollama ollama pull llama3.1

# apps/api/.env
LANDING_AI_PROVIDER=ollama
LANDING_AI_BASE_URL=http://127.0.0.1:11434
LANDING_AI_MODEL=llama3.1

# API HTTP + worker BullMQ (mesmo comando)
pnpm --filter @prospectly/api run dev
```

## Fase 3 — pesquisa OpenStreetMap e importação CSV

### Serviços e variáveis de ambiente

A API executa os processors BullMQ no mesmo processo NestJS. PostgreSQL persiste
pesquisas, resultados, importações e erros; Redis persiste os jobs. Portanto,
Redis é obrigatório tanto para criar pesquisas quanto para confirmar importações
CSV. O `docker-compose.yml` já sobe Redis com AOF e faz a API aguardar o healthcheck
de PostgreSQL e Redis no profile `full`; não é necessário um container de worker
separado nesta fase.

Configure em `apps/api/.env`:

| Variável                  | Finalidade                                                                        | Exemplo local                                  |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| `REDIS_URL`               | Conexão BullMQ; aceita `redis://` e `rediss://`, credenciais e número do database | `redis://localhost:6379`                       |
| `OSM_NOMINATIM_URL`       | Endpoint de geocodificação de município                                           | `https://nominatim.openstreetmap.org/search`   |
| `OSM_OVERPASS_URL`        | Endpoint de consulta de estabelecimentos                                          | `https://overpass-api.de/api/interpreter`      |
| `OSM_USER_AGENT`          | Identificação do aplicativo e contato, obrigatória para uso responsável           | `Prospectly/1.0 (https://seu-dominio.example)` |
| `OSM_TIMEOUT_MS`          | Timeout de cada tentativa HTTP                                                    | `10000`                                        |
| `OSM_RESULT_LIMIT`        | Máximo de resultados normalizados por pesquisa                                    | `100`                                          |
| `CSV_MAX_FILE_SIZE_BYTES` | Limite do upload CSV em memória                                                   | `5242880`                                      |
| `CSV_MAX_ROWS`            | Máximo de linhas de dados por arquivo                                             | `10000`                                        |

Após alterar o schema ou preparar um ambiente novo:

```bash
pnpm db:generate
pnpm db:migrate
```

### Fluxo da API

Todas as rotas exigem JWT. `organizationId`, usuário e papel são obtidos da sessão;
não envie esses campos no body. Escritas aceitam `OWNER`, `ADMIN`, `SALES` e
`MEMBER`; `VIEWER` recebe `403`. Um UUID de recurso pertencente a outra organização
é tratado como inexistente e retorna `404`.

Pesquisa OpenStreetMap:

1. `POST /api/v1/searches` com `category`, `city`, `state` e, opcionalmente,
   `onlyWithoutWebsite` (padrão `true`) cria a pesquisa `PENDING` e responde `202`.
   `category` é um valor canônico do contrato compartilhado:
   `restaurant`, `cafe`, `bar`, `pharmacy`, `hospital`, `clinic`, `supermarket`,
   `bakery`, `butcher`, `clothes`, `hairdresser`, `carpenter`, `electrician`,
   `accountant`, `lawyer`, `hotel`, `hostel` ou `guest_house`.
2. BullMQ processa Nominatim e Overpass; consulte `GET /api/v1/searches/:id`
   enquanto o status for `PENDING` ou `PROCESSING`.
3. Liste resultados paginados em `GET /api/v1/searches/:id/results?page=1&pageSize=20`.
4. Importe a seleção com `POST /api/v1/searches/:id/import` e body
   `{ "resultIds": ["uuid-v4"] }` somente quando a pesquisa estiver `COMPLETED`.
   Repetir a seleção não duplica o lead.

O enqueue é recuperável: pesquisa e CSV persistem o payload necessário no
PostgreSQL antes da publicação, usam o ID do agregado como `jobId` e um
reconciliador republica registros `PENDING` que perderam a janela de dispatch.
O correlation ID HTTP também é persistido e reaparece nos logs estruturados do
worker junto ao ID do tenant e do agregado.

As linhas integrais do CSV são staging interno e nunca fazem parte das respostas
de criação, histórico ou detalhe. Elas permanecem enquanto o job pode sofrer retry
e são apagadas atomicamente quando a importação chega a `COMPLETED` ou `FAILED`.

CSV:

1. Envie multipart (`file`) para `POST /api/v1/imports/csv/preview`.
2. Confirme em `POST /api/v1/imports/csv` com o mesmo `file` e `mapping` como JSON,
   por exemplo `{ "companyName": "Empresa", "email": "E-mail" }`.
3. Consulte `GET /api/v1/imports/:id` durante o processamento e
   `GET /api/v1/imports/:id/errors` para falhas paginadas por linha.

### Formato CSV

- Arquivo `.csv` UTF-8, com ou sem BOM, cabeçalho obrigatório e delimitador `,` ou `;`.
- `companyName` é o único mapping obrigatório. Também são aceitos `phone`, `email`,
  `website`, `category`, `address`, `city`, `state`, `postalCode`, `notes` e `tags`.
- Campos com delimitador devem usar aspas; aspas literais são escapadas como `""`.
- Linhas em branco são ignoradas. Linhas inválidas são registradas sem impedir a
  importação parcial das demais.
- Cada linha valida limites de tamanho, e-mail, URL HTTP(S), UF brasileira,
  telefone brasileiro e CEP antes da ingestão. Mensagens persistidas em
  `ImportError` são públicas e não incluem payloads internos.
- Todo conteúdo é tratado como texto. O backend não interpreta nem executa fórmulas.

Exemplo:

```csv
Empresa;Telefone;E-mail;Cidade;UF;Tags
Padaria Central;11999999999;contato@padaria.example;São Paulo;SP;sem-site|prioridade
"Restaurante Bom; Unidade Centro";1133334444;;Campinas;SP;sem-site
```

### Limitações dos serviços públicos OpenStreetMap

A ausência das tags `website`, `contact:website` e `url` significa apenas
`NO_WEBSITE_REPORTED`: confirme manualmente antes de abordar o lead. Os endpoints
públicos de Nominatim e Overpass são serviços compartilhados, sem SLA para cargas
de produção. O runtime envia User-Agent identificável, mantém cache e reserva em
Redis um intervalo global mínimo de 1 segundo entre chamadas Nominatim, inclusive
retries e entre réplicas. A política pública do
[Nominatim](https://operations.osmfoundation.org/policies/nominatim/) limita uso
pesado e estabelece máximo absoluto de 1 requisição por segundo; consulte também
a documentação de uso do [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).
Para volume contínuo, configure instâncias próprias ou um provedor com capacidade
contratada e preserve a atribuição exigida pelo OpenStreetMap/ODbL.
A tela de resultados exibe essa atribuição com link para os termos do OpenStreetMap.

### Operação e rollout

- Deploy em produção (Render Blueprint): ver [`docs/deploy/render.md`](docs/deploy/render.md) e `render.yaml` na raiz.
- Billing dual (Abacate BRL + Stripe EUR/USD): [`docs/billing/dual-gateways.md`](docs/billing/dual-gateways.md).
- `GET /health/ready` verifica PostgreSQL e Redis; falha de qualquer dependência
  obrigatória retorna `503`.
- A migration de hardening canonicaliza domínio, e-mail e telefone legados e
  adiciona a chave provável `(tenant, nome + cidade + UF)`. Preflights
  não destrutivos interrompem a migration com os IDs conflitantes; resolva-os
  explicitamente e repita o deploy.
- Antes de produção, aplique `prisma migrate deploy` em cópia representativa do
  banco e faça um smoke test controlado do provider configurado.

## Fases de implementação

- [x] **Fase 1 — Fundação:** monorepo, Docker, autenticação (JWT + refresh rotation, Argon2), organizações, RBAC, layout principal
- [x] **Fase 2 — Leads (base):** CRUD, filtros, paginação, tags, responsáveis, detalhes, atividades, tarefas
- [x] **Fase 3 — Prospecção:** pesquisa OpenStreetMap, filas BullMQ, importação seletiva e CSV com deduplicação
- [x] **Fase 4 — Análise:** fila BullMQ, análise de website, proteção SSRF, scoring configurável por organização
- [ ] **Fase 5 — CRM:** pipeline Kanban drag-and-drop, templates, campanhas
- [ ] **Fase 6 — Dashboard e produção:** relatórios, testes E2E Playwright, observabilidade, deploy

## Segurança

- `organizationId` sempre derivado da sessão (JWT), nunca do front-end
- Hash Argon2, refresh token rotation com revogação, lockout após tentativas excessivas
- Helmet, CORS configurável, rate limiting, ValidationPipe global
- Logs estruturados com redação de senhas/tokens
- Secrets somente via variáveis de ambiente

## Licença

Privado.
