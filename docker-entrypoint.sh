#!/bin/sh
set -e

# Default to persistent data volume if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/coderoom.db"
fi

# If using a file-based SQLite database, ensure directory exists
case "$DATABASE_URL" in
  file:*)
    DB_FILE_PATH="${DATABASE_URL#file:}"
    DB_DIR="$(dirname "$DB_FILE_PATH")"
    if [ ! -d "$DB_DIR" ]; then
      mkdir -p "$DB_DIR"
    fi
    ;;
esac

echo "======================================================="
echo "🚀 Initializing CodeRoom Database..."
echo "📁 DATABASE_URL: $DATABASE_URL"

# Automatically apply Prisma schema migrations to SQLite
npx prisma db push --skip-generate

# Seed demo data if requested via environment variable
if [ "$SEED_DATABASE" = "true" ] || [ "$SEED_DEMO_DATA" = "true" ]; then
  echo "🌱 Seeding initial demo data..."
  npx tsx prisma/seed.ts || echo "⚠️ Database seed skipped or already applied."
fi

echo "✅ Database ready."
echo "======================================================="

# Execute the application command
exec "$@"
