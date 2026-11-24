#!/usr/bin/env bash
# Rehearses the Prisma migration chain on a THROWAWAY local PostgreSQL cluster — never on a real database.
#
#   bash scripts/rehearse-migration-chain.sh [--keep]
#
# What it does (staging-migration preflight, docs/STAGING-MIGRATION-PREFLIGHT.md §5):
#   1. creates its own cluster in a temp dir (initdb), listening on a UNIX SOCKET ONLY (listen_addresses='');
#   2. applies every prisma/migrations/*/migration.sql in name order, each in one transaction (psql -1), and lists the
#      migrations that fail (expected today: the two sponsor migrations — their tables were never created by a migration);
#   3. re-applies the ten most recent migrations to show which ones are idempotent;
#   4. rehearses the presence-history rollback: down.sql, then the migration's own SQL again, and counts the triggers;
#   5. stops and deletes the cluster (unless --keep).
#
# It reads NO environment variable, NO .env file and accepts NO connection URL: the only database it can reach is the one
# it just created. It is a rehearsal of the SQL, not of `prisma migrate deploy` (no _prisma_migrations table), and the
# schema it builds is the chain's own, not staging's (staging went through `db push` / self-healing in the past).
set -euo pipefail

PG_BIN="${PG_BIN_DIR:-/usr/lib/postgresql/16/bin}"
KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d /tmp/affisell-migration-rehearsal.XXXXXX)"
PORT=55433
RUN_AS=()
if [ "$(id -u)" = "0" ]; then
  id postgres >/dev/null 2>&1 || { echo "running as root needs a 'postgres' system user" >&2; exit 2; }
  chown postgres "$WORK"
  RUN_AS=(su postgres -c)
fi
run() { if [ ${#RUN_AS[@]} -gt 0 ]; then "${RUN_AS[@]}" "$*"; else bash -c "$*"; fi; }

cleanup() {
  run "$PG_BIN/pg_ctl -D $WORK/data -m immediate stop >/dev/null 2>&1" || true
  [ "$KEEP" = 1 ] && echo "cluster kept in $WORK (socket $WORK, port $PORT)" || rm -rf "$WORK"
}
trap cleanup EXIT

run "$PG_BIN/initdb -D $WORK/data -U postgres -A trust >/dev/null"
run "$PG_BIN/pg_ctl -D $WORK/data -o \"-p $PORT -k $WORK -c listen_addresses=''\" -l $WORK/log start >/dev/null"
sleep 2
PSQL=("$PG_BIN/psql" -h "$WORK" -p "$PORT" -U postgres)
"${PSQL[@]}" -qc "create database rehearsal_test"
Q=("${PSQL[@]}" -d rehearsal_test -v ON_ERROR_STOP=1 -q -1)

total=0; failed=0
for dir in $(ls "$ROOT/prisma/migrations" | grep -v '\.toml$'); do
  total=$((total + 1))
  if ! "${Q[@]}" -f "$ROOT/prisma/migrations/$dir/migration.sql" >"$WORK/out.txt" 2>&1; then
    failed=$((failed + 1))
    echo "FAIL $dir :: $(grep -m1 ERROR "$WORK/out.txt" | sed 's/.*ERROR: *//' | cut -c1-120)"
  fi
done
echo "chain: $total migrations, $failed failed"

echo "--- re-apply of the ten most recent migrations (idempotence)"
for dir in $(ls "$ROOT/prisma/migrations" | grep -v '\.toml$' | tail -10); do
  if "${Q[@]}" -f "$ROOT/prisma/migrations/$dir/migration.sql" >"$WORK/out.txt" 2>&1; then echo "idempotent      $dir"
  else echo "not idempotent  $dir :: $(grep -m1 ERROR "$WORK/out.txt" | sed 's/.*ERROR: *//' | cut -c1-100)"; fi
done

echo "--- presence-history rollback rehearsal"
T=("${PSQL[@]}" -d rehearsal_test -v ON_ERROR_STOP=1 -qAt)
COUNT="select count(*) from pg_trigger where tgname in ('AffiliateProduct_listing_presence_history','ListingPresenceEvent_append_only','ListingPresenceEvent_no_truncate')"
echo "before: triggers=$("${T[@]}" -c "$COUNT")"
"${T[@]}" -1 -f "$ROOT/scripts/migration-rollbacks/20261124090000_listing_presence_history.down.sql"
echo "after down.sql: triggers=$("${T[@]}" -c "$COUNT") table=$("${T[@]}" -c "select to_regclass('\"ListingPresenceEvent\"') is not null")"
"${T[@]}" -1 -f "$ROOT/prisma/migrations/20261124090000_listing_presence_history/migration.sql" 2>/dev/null
echo "after re-apply: triggers=$("${T[@]}" -c "$COUNT") table=$("${T[@]}" -c "select to_regclass('\"ListingPresenceEvent\"') is not null")"
