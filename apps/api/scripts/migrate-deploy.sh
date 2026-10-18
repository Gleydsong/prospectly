#!/bin/sh
set -eu

echo "==> [Migrate Deploy] Starting database migrations..."

if [ -z "${MIGRATION_DATABASE_URL:-}" ]; then
  echo "ERROR: MIGRATION_DATABASE_URL is not set. Migrations require the owner database connection string." >&2
  exit 1
fi

# Map the dedicated owner connection string only in this migration process;
# this avoids accidental runtime fallback.
export DATABASE_URL="$MIGRATION_DATABASE_URL"
unset MIGRATION_DATABASE_URL

# Locate prisma schema (supports running from repository root or container /app)
if [ -f "./prisma/schema.prisma" ]; then
  SCHEMA_PATH="./prisma/schema.prisma"
elif [ -f "./apps/api/prisma/schema.prisma" ]; then
  SCHEMA_PATH="./apps/api/prisma/schema.prisma"
else
  echo "ERROR: Could not locate prisma/schema.prisma in . or ./apps/api" >&2
  exit 1
fi

echo "==> Using schema at ${SCHEMA_PATH}"

# Execute migrations using available Prisma CLI
if command -v prisma >/dev/null 2>&1; then
  prisma migrate deploy --schema="${SCHEMA_PATH}"
elif [ -x "./node_modules/.bin/prisma" ]; then
  ./node_modules/.bin/prisma migrate deploy --schema="${SCHEMA_PATH}"
elif [ -x "./apps/api/node_modules/.bin/prisma" ]; then
  ./apps/api/node_modules/.bin/prisma migrate deploy --schema="${SCHEMA_PATH}"
else
  npx --no-install prisma migrate deploy --schema="${SCHEMA_PATH}"
fi

echo "==> [Migrate Deploy] Migrations applied successfully."
