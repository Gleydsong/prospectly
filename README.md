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

| E-mail | Senha | Papel |
|---|---|---|
| demo@prospectly.dev | Demo123! | OWNER |
| admin@prospectly.dev | Demo123! | ADMIN |
| sales@prospectly.dev | Demo123! | SALES |
| viewer@prospectly.dev | Demo123! | VIEWER |

## Comandos

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia web + api em modo desenvolvimento |
| `pnpm build` | Build de todos os pacotes |
| `pnpm lint` | Lint em todos os pacotes |
| `pnpm test` | Testes em todos os pacotes |
| `pnpm typecheck` | Verificação de tipos |
| `pnpm db:migrate` | Prisma migrate dev |
| `pnpm db:seed` | Seed do banco |
| `docker compose up -d` | Sobe PostgreSQL + Redis |
| `docker compose --profile full up -d` | Sobe stack completa (db, redis, api, web) |

## Fases de implementação

- [x] **Fase 1 — Fundação:** monorepo, Docker, autenticação (JWT + refresh rotation, Argon2), organizações, RBAC, layout principal
- [x] **Fase 2 — Leads (base):** CRUD, filtros, paginação, tags, responsáveis, detalhes, atividades, tarefas
- [ ] **Fase 3 — Prospecção:** pesquisa com provedor mock, importação de resultados, CSV, deduplicação
- [ ] **Fase 4 — Análise:** fila BullMQ, análise de website, proteção SSRF, scoring
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
