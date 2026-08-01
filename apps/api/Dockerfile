# Prospectly API — production image
# Stages: deps → build → pruned → migrate (optional) → runner → worker | api (default)
# Migrations are NOT run on container start. See docs/deploy/migrations.md
# Workers: docs/deploy/workers.md

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/tsconfig/package.json packages/tsconfig/
# Required for `pnpm deploy` to inline workspace packages into the prod tree
RUN printf 'inject-workspace-packages=true\n' > .npmrc
RUN pnpm install --frozen-lockfile --filter @prospectly/api...

FROM deps AS build
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @prospectly/shared-types run build
RUN pnpm --filter @prospectly/api exec prisma generate
RUN pnpm --filter @prospectly/api run build

# Production-only dependency tree (no Nest CLI, Jest, ESLint, prisma CLI, etc.)
FROM build AS pruned
RUN pnpm --filter @prospectly/api deploy --prod /prod/api
# `dist` is gitignored and may be omitted by deploy — copy explicitly
RUN cp -R /app/apps/api/dist /prod/api/dist \
  && cp -R /app/apps/api/prisma /prod/api/prisma
# Generate @prisma/client into the pruned node_modules (CLI comes from build tree)
WORKDIR /prod/api
RUN /app/apps/api/node_modules/.bin/prisma generate --schema=/prod/api/prisma/schema.prisma \
  && rm -f /prod/api/prisma/seed.ts

# Optional image for a single release/migrate job: docker build --target migrate
FROM pruned AS migrate
WORKDIR /prod/api
# prisma CLI only in this target — not shipped in the web runner
RUN PRISMA_VERSION="$(node -p "require('@prisma/client/package.json').version")" \
  && npm install --no-save "prisma@${PRISMA_VERSION}" \
  && npm cache clean --force
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# Minimal runtime — production node_modules + generated client only
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nestjs

COPY --from=pruned --chown=nestjs:nodejs /prod/api/package.json ./package.json
COPY --from=pruned --chown=nestjs:nodejs /prod/api/node_modules ./node_modules
COPY --from=pruned --chown=nestjs:nodejs /prod/api/dist ./dist
# Schema kept for runtime introspection / clarity; migrations stay out of the web image
COPY --from=pruned --chown=nestjs:nodejs /prod/api/prisma/schema.prisma ./prisma/schema.prisma

USER nestjs

# Worker target — no HTTP, no migrate (migrations run once on API release).
# Build: docker build --target worker -f apps/api/Dockerfile .
FROM runner AS worker
ENV ROLE=worker
CMD ["node", "dist/worker.js"]

# Default / API target (last stage) — used by Render when dockerCommand/target unset.
FROM runner AS api
ENV ROLE=api
EXPOSE 3000
CMD ["node", "dist/main.js"]
