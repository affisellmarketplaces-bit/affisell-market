#!/usr/bin/env bash
# CI: the migration chain must rebuild the Prisma schema on its own (docs/MIGRATION-LINEAGE.md).
#
# Runs ONLY against the CI service PostgreSQL (loopback). It refuses any other host before connecting.
#   1. empty database  → `prisma migrate deploy` of the whole chain (Prisma's own runner, _prisma_migrations written)
#   2. `prisma migrate diff --from-url <that db> --to-schema-datamodel` must report NO difference (exit code 0)
#   3. `prisma migrate status` must say the database is up to date
#   4. "existing history" database: the chain WITHOUT the newest migrations, with the objects they add already present
#      (as on a database that got them outside the chain), then the full chain → every repair migration recorded as
#      applied, schema unchanged by them, status up to date.
# Needs: PGHOST/PGPORT/PGUSER of the CI service, psql, the Prisma CLI (npm ci).
set -euo pipefail

HOST="${PGHOST:-127.0.0.1}"
case "$HOST" in 127.0.0.1|localhost|::1) ;; *) echo "refused: PGHOST must be loopback (got a non-local host)" >&2; exit 2 ;; esac
PORT="${PGPORT:-5432}"; USER_="${PGUSER:-postgres}"
url() { printf 'postgresql://%s@%s:%s/%s' "$USER_" "$HOST" "$PORT" "$1"; }
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -h "$HOST" -p "$PORT" -U "$USER_" -v ON_ERROR_STOP=1 -q)

fresh_db() { "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1"; }

echo "::group::1. empty database, prisma migrate deploy of the whole chain"
fresh_db chain_test
DATABASE_URL="$(url chain_test)" DIRECT_URL="$(url chain_test)" DATABASE_URL_UNPOOLED="$(url chain_test)" \
  npx prisma migrate deploy
echo "::endgroup::"

echo "::group::2. chain-built schema vs Prisma datamodel"
DATABASE_URL="$(url chain_test)" npx prisma migrate diff \
  --from-url "$(url chain_test)" --to-schema-datamodel "$ROOT/prisma/schema.prisma" --exit-code \
  || { echo "::error::the migration chain does not rebuild prisma/schema.prisma (diff above)"; exit 1; }
echo "::endgroup::"

echo "::group::3. migrate status"
DATABASE_URL="$(url chain_test)" DIRECT_URL="$(url chain_test)" DATABASE_URL_UNPOOLED="$(url chain_test)" \
  npx prisma migrate status
echo "::endgroup::"

echo "::group::4. existing-history database receiving the lineage repairs"
REPAIRS=(20260801205900_sponsor_campaign_lineage 20261124120000_migration_lineage_repair)
OLD="$(mktemp -d)"; mkdir -p "$OLD/migrations"
cp "$ROOT/prisma/migrations/migration_lock.toml" "$OLD/migrations/"
for dir in $(ls "$ROOT/prisma/migrations" | grep -v '\.toml$'); do
  skip=0; for r in "${REPAIRS[@]}"; do [ "$dir" = "$r" ] && skip=1; done
  [ "$skip" = 0 ] && cp -r "$ROOT/prisma/migrations/$dir" "$OLD/migrations/"
done
fresh_db history_test
# A database built outside the chain already had "SponsorCampaign" before 20260801210000 ran: create the table
# (no foreign key yet: "User" does not exist on an empty database) from the lineage file, up to its DO block.
"${PSQL[@]}" -d history_test -f <(awk '/^DO \$\$/{exit} {print}' "$ROOT/prisma/migrations/20260801205900_sponsor_campaign_lineage/migration.sql")
# Old chain applied by Prisma from a copy that lacks the repairs (as staging / production saw it).
cp "$ROOT/prisma/schema.prisma" "$OLD/schema.prisma"
DATABASE_URL="$(url history_test)" DIRECT_URL="$(url history_test)" DATABASE_URL_UNPOOLED="$(url history_test)" \
  npx prisma migrate deploy --schema "$OLD/schema.prisma"
# Then what those databases got outside the chain (foreign keys, index, capture table), as plain SQL.
for r in "${REPAIRS[@]}"; do "${PSQL[@]}" -d history_test -f "$ROOT/prisma/migrations/$r/migration.sql"; done
pg_dump -h "$HOST" -p "$PORT" -U "$USER_" -s history_test | grep -v '^\\\(un\)\?restrict' > "$OLD/before.sql"
DATABASE_URL="$(url history_test)" DIRECT_URL="$(url history_test)" DATABASE_URL_UNPOOLED="$(url history_test)" \
  npx prisma migrate deploy
pg_dump -h "$HOST" -p "$PORT" -U "$USER_" -s history_test | grep -v '^\\\(un\)\?restrict' > "$OLD/after.sql"
diff "$OLD/before.sql" "$OLD/after.sql" || { echo "::error::a lineage repair changed an existing database"; exit 1; }
for r in "${REPAIRS[@]}"; do
  n="$("${PSQL[@]}" -d history_test -Atc "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name = '$r' AND finished_at IS NOT NULL AND rolled_back_at IS NULL")"
  [ "$n" = 1 ] || { echo "::error::$r is not recorded as applied once (count=$n)"; exit 1; }
done
DATABASE_URL="$(url history_test)" DIRECT_URL="$(url history_test)" DATABASE_URL_UNPOOLED="$(url history_test)" \
  npx prisma migrate status
echo "::endgroup::"
echo "migration chain: OK"
