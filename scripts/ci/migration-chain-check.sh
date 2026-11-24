#!/usr/bin/env bash
# CI proof that the migration chain rebuilds the Prisma schema on its own (docs/MIGRATION-LINEAGE.md).
#
# Runs ONLY against the CI service PostgreSQL (loopback host, its own databases *_chain_test). Refuses any other host
# BEFORE connecting. Every scenario runs; the script fails at the end if any proof failed.
#
#   S1  fresh database: `prisma migrate deploy` of the whole chain, every migration recorded exactly once
#   S2  fresh database vs prisma/schema.prisma: `prisma migrate diff --exit-code` (structure, not mere existence)
#   S3  RETROACTIVE INSERTION: the chain WITHOUT the two repairs is applied by Prisma (so migrations dated AFTER
#       20260801205900 are already recorded), then the repairs appear in the directory and `migrate deploy` runs again
#         S3a complete history — every repaired object already present (as `db push` would have left it)
#         S3b partial history  — AdminAeCaptureSession missing
#       proofs: status lists the back-dated migration as pending; deploy applies it; pre-existing objects byte-identical
#       in pg_dump; only the expected objects added; each repair recorded exactly once; earlier rows untouched;
#       final schema = fresh schema = Prisma datamodel
#   S4  second run on every database: deploy applies nothing, both repairs re-run as plain SQL change nothing,
#       no duplicate row in _prisma_migrations
set -uo pipefail

HOST="${PGHOST:-127.0.0.1}"
case "$HOST" in 127.0.0.1|localhost|::1) ;; *) echo "refused: PGHOST must be loopback" >&2; exit 2 ;; esac
PORT="${PGPORT:-5432}"; PGU="${PGUSER:-postgres}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MIG="$ROOT/prisma/migrations"
REPAIRS=(20260801205900_sponsor_campaign_lineage 20261124120000_migration_lineage_repair)
WORK="$(mktemp -d)"; HIDDEN="$WORK/hidden-repairs"; mkdir -p "$HIDDEN"
FAILURES=()

# sslmode=disable: the CI service has no TLS, and scripts/ensure-direct-url.mjs (loaded by prisma.config.ts) would
# otherwise add sslmode=require.
url() { printf 'postgresql://%s@%s:%s/%s?sslmode=disable' "$PGU" "$HOST" "$PORT" "$1"; }
psqlq() { psql -h "$HOST" -p "$PORT" -U "$PGU" -v ON_ERROR_STOP=1 -X "$@"; }
prisma_on() { local db="$1"; shift; DATABASE_URL="$(url "$db")" DIRECT_URL="$(url "$db")" DATABASE_URL_UNPOOLED="$(url "$db")" npx prisma "$@"; }
dump() { pg_dump -h "$HOST" -p "$PORT" -U "$PGU" -s --no-owner --no-privileges "$1" | grep -v -E '^\\(un)?restrict ' > "$2"; }
fresh_db() { psqlq -d postgres -qc "DROP DATABASE IF EXISTS $1" -c "CREATE DATABASE $1"; }
ok() { echo "PROOF OK   — $1"; }
ko() { echo "::error::PROOF FAILED — $1"; FAILURES+=("$1"); }
hide_repairs() { for r in "${REPAIRS[@]}"; do mv "$MIG/$r" "$HIDDEN/"; done; }
show_repairs() { for r in "${REPAIRS[@]}"; do [ -d "$HIDDEN/$r" ] && mv "$HIDDEN/$r" "$MIG/"; done; return 0; }
trap show_repairs EXIT
mig_rows() { psqlq -d "$1" -Atc "SELECT migration_name, count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), count(*) FROM \"_prisma_migrations\" GROUP BY 1 ORDER BY 1"; }
diff_prisma() { # $1 db, $2 label
  prisma_on "$1" migrate diff --from-url "$(url "$1")" --to-schema-datamodel "$ROOT/prisma/schema.prisma" --script > "$WORK/$1.prisma-diff.sql" 2>"$WORK/$1.prisma-diff.err"
  prisma_on "$1" migrate diff --from-url "$(url "$1")" --to-schema-datamodel "$ROOT/prisma/schema.prisma" --exit-code >/dev/null 2>&1
  local rc=$?
  echo "--- prisma migrate diff ($2) exit=$rc (0 = no difference, 2 = differences) ---"
  cat "$WORK/$1.prisma-diff.sql"; [ -s "$WORK/$1.prisma-diff.err" ] && sed 's/^/stderr: /' "$WORK/$1.prisma-diff.err"
  if [ "$rc" = 0 ]; then ok "$2: schema identical to prisma/schema.prisma (prisma migrate diff --exit-code = 0)"
  else ko "$2: schema differs from prisma/schema.prisma (prisma migrate diff exit $rc, script above)"; fi
}
expected_migration_count=$(ls "$MIG" | grep -vc '\.toml$')

echo "::group::S1 — fresh database, prisma migrate deploy of the whole chain ($expected_migration_count migrations)"
fresh_db fresh_chain_test
prisma_on fresh_chain_test migrate deploy > "$WORK/fresh.deploy" 2>&1; rc=$?
tail -n 12 "$WORK/fresh.deploy"
[ "$rc" = 0 ] || ko "S1: migrate deploy exit $rc"
mig_rows fresh_chain_test > "$WORK/fresh.rows"
applied=$(awk -F'|' '$2==1 && $3==1' "$WORK/fresh.rows" | wc -l)
if [ "$applied" = "$expected_migration_count" ]; then ok "S1: $applied/$expected_migration_count migrations applied, each recorded exactly once"
else ko "S1: $applied/$expected_migration_count migrations recorded once"; cat "$WORK/fresh.rows"; fi
prisma_on fresh_chain_test migrate status 2>&1 | tail -n 3
echo "::endgroup::"

echo "::group::S2 — fresh database vs Prisma datamodel (full structural diff)"
diff_prisma fresh_chain_test "S2 fresh"
dump fresh_chain_test "$WORK/fresh.sql"
echo "::endgroup::"

FIRST_SPONSOR=20260801210000_sponsor_success_fee
history_db() { # $1 db name, $2 mode complete|partial
  local db="$1" mode="$2" later="$WORK/$1.later"; mkdir -p "$later"
  fresh_db "$db"
  hide_repairs
  # 1. Prisma applies the chain up to the migration just before 20260801210000, as the shared databases received it.
  for d in $(ls "$MIG" | grep -v '\.toml$'); do [[ "$d" > "$FIRST_SPONSOR" || "$d" == "$FIRST_SPONSOR" ]] && mv "$MIG/$d" "$later/"; done
  echo "--- $db: chain up to the migration before $FIRST_SPONSOR, applied by Prisma ---"
  prisma_on "$db" migrate deploy > "$WORK/$db.old1.deploy" 2>&1 || { ko "$db: first part of the old chain failed"; cat "$WORK/$db.old1.deploy"; }
  tail -n 2 "$WORK/$db.old1.deploy"
  # 2. "SponsorCampaign" appears OUTSIDE the chain (as `prisma db push` did), with its keys: the lineage SQL as plain SQL.
  psqlq -d "$db" -q -f "$HIDDEN/${REPAIRS[0]}/migration.sql"   # the repairs are hidden from Prisma at this point
  # 3. Prisma applies the rest of the old chain (repairs still absent from the directory).
  mv "$later"/* "$MIG/"
  prisma_on "$db" migrate deploy > "$WORK/$db.old2.deploy" 2>&1 || { ko "$db: second part of the old chain failed"; cat "$WORK/$db.old2.deploy"; }
  tail -n 2 "$WORK/$db.old2.deploy"
  show_repairs
  # 4. The rest of what those databases got outside the chain.
  psqlq -d "$db" -qc 'CREATE INDEX IF NOT EXISTS "SponsorCampaign_billingMode_status_idx" ON "SponsorCampaign"("billingMode", "status")'
  if [ "$mode" = complete ]; then psqlq -d "$db" -q -f "$MIG/${REPAIRS[1]}/migration.sql"; fi
  local pre; pre=$(psqlq -d "$db" -Atc "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name IN ('${REPAIRS[0]}','${REPAIRS[1]}')")
  [ "$pre" = 0 ] || ko "$db: repairs already recorded before the retroactive deploy ($pre)"
}

retro_deploy() { # $1 db, $2 label, $3 expected added object names (space separated, may be empty)
  local db="$1" label="$2" expected="$3"
  dump "$db" "$WORK/$db.before.sql"; mig_rows "$db" > "$WORK/$db.before.rows"
  local newest; newest=$(psqlq -d "$db" -Atc "SELECT max(migration_name) FROM \"_prisma_migrations\"")
  echo "--- before: $(wc -l < "$WORK/$db.before.rows") migrations recorded, newest = $newest (dated after ${REPAIRS[0]}) ---"
  echo "--- prisma migrate status, back-dated migration now in the directory ---"
  prisma_on "$db" migrate status > "$WORK/$db.status" 2>&1; local st=$?
  cat "$WORK/$db.status"
  if grep -q "${REPAIRS[0]}" "$WORK/$db.status"; then ok "$label: migrate status lists the back-dated ${REPAIRS[0]} as not yet applied (status exit $st)"
  else ko "$label: migrate status does NOT list the back-dated migration (status exit $st)"; fi
  echo "--- prisma migrate deploy (retroactive insertion) ---"
  prisma_on "$db" migrate deploy > "$WORK/$db.deploy" 2>&1; local dp=$?
  cat "$WORK/$db.deploy"
  if [ "$dp" = 0 ]; then ok "$label: migrate deploy exit 0 with a migration dated before applied ones"; else ko "$label: migrate deploy exit $dp"; fi
  for r in "${REPAIRS[@]}"; do
    local n all
    n=$(psqlq -d "$db" -Atc "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='$r' AND finished_at IS NOT NULL AND rolled_back_at IS NULL")
    all=$(psqlq -d "$db" -Atc "SELECT count(*) FROM \"_prisma_migrations\" WHERE migration_name='$r'")
    if [ "$n" = 1 ] && [ "$all" = 1 ]; then ok "$label: $r recorded exactly once (finished, not rolled back)"; else ko "$label: $r rows=$all finished=$n"; fi
  done
  psqlq -d "$db" -Atc "SELECT migration_name || '  started ' || to_char(started_at,'YYYY-MM-DD HH24:MI:SS.MS') FROM \"_prisma_migrations\" WHERE migration_name IN ('${REPAIRS[0]}','$newest') ORDER BY started_at" \
    | sed 's/^/order of application: /'
  mig_rows "$db" | grep -v -e "${REPAIRS[0]}" -e "${REPAIRS[1]}" > "$WORK/$db.after.rows"
  if diff -q "$WORK/$db.before.rows" "$WORK/$db.after.rows" >/dev/null; then ok "$label: rows of the migrations already applied are unchanged"
  else ko "$label: _prisma_migrations rows of earlier migrations changed"; fi
  dump "$db" "$WORK/$db.after.sql"
  diff "$WORK/$db.before.sql" "$WORK/$db.after.sql" > "$WORK/$db.schema.diff"
  echo "--- pg_dump -s diff before/after the retroactive deploy ($(grep -c '^[<>]' "$WORK/$db.schema.diff") changed lines) ---"; cat "$WORK/$db.schema.diff"
  if grep -q '^<' "$WORK/$db.schema.diff"; then ko "$label: a pre-existing object was modified or removed (lines '<' above)"
  else ok "$label: every pre-existing object is byte-identical in pg_dump (no line removed or changed)"; fi
  local added want
  # pg_dump names a constraint "<table> <constraint>": keep the object's own name (last word).
  added=$(grep -oE '^> -- Name: [^;]+' "$WORK/$db.schema.diff" | sed -e 's/^> -- Name: //' -e 's/.* //' | sort -u | tr '\n' ' ')
  want=""; [ -n "$expected" ] && want=$(printf '%s\n' $expected | sort -u | tr '\n' ' ')
  if [ "$added" = "$want" ]; then ok "$label: objects added = exactly the expected ones [${want% }]"
  else ko "$label: objects added [${added% }] ≠ expected [${want% }]"; fi
  diff_prisma "$db" "$label final"
  if diff -q <(grep -v ensure-direct-url "$WORK/fresh_chain_test.prisma-diff.sql") <(grep -v ensure-direct-url "$WORK/$db.prisma-diff.sql") >/dev/null; then
    ok "$label: its Prisma diff is identical to the fresh database's (no difference introduced by the history or the repairs)"
  else ko "$label: its Prisma diff differs from the fresh database's"; fi
  if diff -u "$WORK/fresh.sql" "$WORK/$db.after.sql" > "$WORK/$db.vs-fresh.diff"; then ok "$label: final pg_dump identical to the fresh chain-built database"
  else ko "$label: final schema differs from the fresh database"; cat "$WORK/$db.vs-fresh.diff"; fi
}

echo "::group::S2b — structure of the repaired objects vs a database built from the Prisma datamodel"
fresh_db model_chain_test
prisma_on model_chain_test migrate diff --from-empty --to-schema-datamodel "$ROOT/prisma/schema.prisma" --script 2>/dev/null \
  | grep -v '^\[ensure-direct-url\]' > "$WORK/model.sql"
psqlq -d model_chain_test -q -f "$WORK/model.sql" > /dev/null
LINEAGE_TABLES=(SponsorCampaign SponsorCampaignCharge AdminAeCaptureSession)
# Order-insensitive catalogue of the tables (a column added later by ALTER sits at the end; Prisma ignores order too):
# every column with type / nullability / default, every index definition, every constraint definition.
table_dump() { psqlq -d "$1" -At > "$2" <<SQL
SELECT 'column ' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
       || CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE ' NULL' END
       || coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '')
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'public' AND c.relname IN ('SponsorCampaign','SponsorCampaignCharge','AdminAeCaptureSession')
  AND a.attnum > 0 AND NOT a.attisdropped
UNION ALL
SELECT 'index ' || indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('SponsorCampaign','SponsorCampaignCharge','AdminAeCaptureSession')
UNION ALL
SELECT 'constraint ' || cl.relname || '.' || co.conname || ' ' || pg_get_constraintdef(co.oid)
FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public' AND cl.relname IN ('SponsorCampaign','SponsorCampaignCharge','AdminAeCaptureSession')
ORDER BY 1;
SQL
}
table_dump model_chain_test "$WORK/model.lineage.sql"; table_dump fresh_chain_test "$WORK/fresh.lineage.sql"
# Prisma's datamodel cannot express CHECK constraints: the published migration 20260801210000 adds
# SponsorCampaignCharge_status_check, which a datamodel-built database can never have. Listed, then set aside (only CHECKs).
grep -E '^constraint [^ ]+ CHECK ' "$WORK/fresh.lineage.sql" | sed 's/^/CHECK constraint present in the chain, not expressible in the datamodel: /'
for f in model fresh; do grep -v -E '^constraint [^ ]+ CHECK ' "$WORK/$f.lineage.sql" > "$WORK/$f.lineage.nocheck.sql"; mv "$WORK/$f.lineage.nocheck.sql" "$WORK/$f.lineage.sql"; done
echo "--- columns, types, defaults, keys, indexes, foreign keys of ${LINEAGE_TABLES[*]}: chain-built vs datamodel-built ---"
if diff -u "$WORK/model.lineage.sql" "$WORK/fresh.lineage.sql"; then ok "S2b: ${LINEAGE_TABLES[*]} are structurally identical to the Prisma datamodel (columns, types, defaults, nullability, indexes, constraints)"
else ko "S2b: repaired tables differ structurally from the Prisma datamodel (diff above)"; fi
if grep -qE 'SponsorCampaign|AdminAeCaptureSession' "$WORK/fresh_chain_test.prisma-diff.sql"; then ko "S2b: Prisma diff still mentions a repaired object"
else ok "S2b: the Prisma diff of the fresh database mentions no repaired object (the remaining diff, if any, is drift outside the lineage repair)"; fi
echo "::endgroup::"

echo "::group::S3a — retroactive insertion on a COMPLETE existing history"
history_db hista_chain_test complete
retro_deploy hista_chain_test "S3a complete history" ""
echo "::endgroup::"

echo "::group::S3b — retroactive insertion on a PARTIAL existing history (AdminAeCaptureSession missing)"
history_db histb_chain_test partial
retro_deploy histb_chain_test "S3b partial history" 'AdminAeCaptureSession AdminAeCaptureSession_productId_expiresAt_idx AdminAeCaptureSession_pkey'
echo "::endgroup::"

echo "::group::S4 — second run on every database (no duplicate, no side effect)"
for db in fresh_chain_test hista_chain_test histb_chain_test; do
  dump "$db" "$WORK/$db.s4.before.sql"; mig_rows "$db" > "$WORK/$db.s4.before.rows"
  prisma_on "$db" migrate deploy > "$WORK/$db.s4.deploy" 2>&1; rc=$?
  tail -n 2 "$WORK/$db.s4.deploy"
  if grep -q "No pending migrations" "$WORK/$db.s4.deploy" && [ "$rc" = 0 ]; then ok "S4 $db: second deploy applies nothing"; else ko "S4 $db: second deploy exit $rc"; fi
  for r in "${REPAIRS[@]}"; do psqlq -d "$db" -q -f "$MIG/$r/migration.sql" >/dev/null 2>&1 || ko "S4 $db: re-running $r as plain SQL failed"; done
  dump "$db" "$WORK/$db.s4.after.sql"; mig_rows "$db" > "$WORK/$db.s4.after.rows"
  if diff -q "$WORK/$db.s4.before.sql" "$WORK/$db.s4.after.sql" >/dev/null; then ok "S4 $db: schema unchanged after second deploy + re-run of both repairs"
  else ko "S4 $db: schema changed on second run"; diff "$WORK/$db.s4.before.sql" "$WORK/$db.s4.after.sql"; fi
  if diff -q "$WORK/$db.s4.before.rows" "$WORK/$db.s4.after.rows" >/dev/null; then ok "S4 $db: _prisma_migrations unchanged"; else ko "S4 $db: _prisma_migrations changed"; fi
  dup=$(psqlq -d "$db" -Atc "SELECT count(*) FROM (SELECT migration_name FROM \"_prisma_migrations\" GROUP BY 1 HAVING count(*) > 1) d")
  if [ "$dup" = 0 ]; then ok "S4 $db: no duplicated migration row"; else ko "S4 $db: $dup duplicated migration rows"; fi
done
echo "::endgroup::"

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo "::error::migration chain proof: ${#FAILURES[@]} failure(s)"; printf ' - %s\n' "${FAILURES[@]}"; exit 1
fi
echo "migration chain proof: every scenario passed"
