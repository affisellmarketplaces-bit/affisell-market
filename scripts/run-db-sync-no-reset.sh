#!/usr/bin/env bash
# Apply pending Prisma migrations on Neon WITHOUT migrate reset.
# Usage: bash scripts/run-db-sync-no-reset.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/4 Stop dev servers (free Neon pool) =="
pkill -f "next-dev-port" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
for port in 3001 3000 3002; do
  lsof -ti:"$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done
sleep 1

echo "== 2/4 Env: DATABASE_URL + pool limits =="
node scripts/merge-env-from-backup.mjs 2>/dev/null || true
node scripts/patch-database-url-pool.mjs

echo "== 3/4 prisma migrate deploy (no reset, no migrate dev) =="
node scripts/prisma-with-env.mjs migrate deploy

echo "== 4/4 Status =="
node scripts/prisma-with-env.mjs migrate status

echo ""
echo "Done. If drift persists locally, run: node scripts/prisma-with-env.mjs migrate status"
echo "Do NOT run migrate reset on Neon."
