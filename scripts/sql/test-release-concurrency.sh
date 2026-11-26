#!/usr/bin/env bash
# Concurrency proofs for the payout release (#26) and the dispute ledger (D7), on a THROWAWAY PostgreSQL only.
# Runs the exact statements the code issues, 20 sessions at once, and checks that exactly one wins.
# Usage: PGHOST=/tmp PGPORT=55432 PGUSER=postgres PGDATABASE=affi bash scripts/sql/test-release-concurrency.sh
# Refuses anything that is not a local socket / localhost (never point it at staging or production).
set -euo pipefail
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "refused: PGHOST must be a local socket dir or localhost" >&2; exit 2 ;; esac
P="psql -qAtX -v ON_ERROR_STOP=1"
fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1 ($2)"; else echo "FAIL $1: got $2, want $3"; fail=1; fi; }

$P <<'SQL'
SET session_replication_role = replica; -- fixtures only: skip the FK to Order (throwaway database)
DELETE FROM "TransferAttempt" WHERE id = 'att_conc';
DELETE FROM "ProcessedWebhook" WHERE id LIKE 'dispute:dp_conc:%';
INSERT INTO "TransferAttempt" (id, "orderId", role, "amountCents", destination, status, attempts)
VALUES ('att_conc', 'ord_conc', 'AFFILIATE', 3200, 'acct_x', 'PENDING', 0);
SQL

# 1. Lease claim (process-transfers): 20 concurrent runs, exactly one may go on to Stripe.
CLAIM="UPDATE \"TransferAttempt\" SET \"lastAttemptAt\" = NOW() WHERE id = 'att_conc' AND status = 'PENDING'
       AND (\"lastAttemptAt\" IS NULL OR \"lastAttemptAt\" < NOW() - INTERVAL '5 minutes') RETURNING id;"
out=$(for i in $(seq 20); do ($P -c "$CLAIM") & done; wait)
check "lease: 20 concurrent claims -> winners" "$(echo "$out" | grep -c att_conc || true)" 1
check "lease: a second claim inside the lease" "$($P -c "$CLAIM" | grep -c att_conc || true)" 0
$P -c "UPDATE \"TransferAttempt\" SET \"lastAttemptAt\" = NOW() - INTERVAL '6 minutes' WHERE id = 'att_conc'"
check "lease: an expired lease (crashed run) can be claimed again" "$($P -c "$CLAIM" | grep -c att_conc || true)" 1
$P -c "UPDATE \"TransferAttempt\" SET status = 'SUCCESS', \"lastAttemptAt\" = NULL WHERE id = 'att_conc'"
check "lease: a SUCCESS attempt is never claimed" "$($P -c "$CLAIM" | grep -c att_conc || true)" 0

# 2. Dispute hold opened by 20 concurrent `created` / `updated` deliveries: one row.
OPEN="INSERT INTO \"ProcessedWebhook\" (id, \"orderId\", status, error, \"createdAt\")
      VALUES ('dispute:dp_conc:ord_conc', 'ord_conc', 'dispute_open', NULL, NOW()) ON CONFLICT (id) DO NOTHING RETURNING id;"
out=$(for i in $(seq 20); do ($P -c "$OPEN") & done; wait)
check "dispute: 20 concurrent opens -> rows created" "$(echo "$out" | grep -c dispute: || true)" 1

# 3. `won` and `lost` racing (two closes): exactly one terminal outcome, never rewritten.
CLOSE() { echo "UPDATE \"ProcessedWebhook\" SET status = '$1' WHERE id = 'dispute:dp_conc:ord_conc' AND status = 'dispute_open' RETURNING status;"; }
out=$( ($P -c "$(CLOSE dispute_won)") & ($P -c "$(CLOSE dispute_lost)") & wait)
check "dispute: concurrent won/lost -> closes applied" "$(echo "$out" | grep -c dispute_ || true)" 1
final=$($P -c "SELECT status FROM \"ProcessedWebhook\" WHERE id = 'dispute:dp_conc:ord_conc'")
check "dispute: a late 'created' after close does not reopen" "$($P -c "$OPEN" | grep -c dispute: || true)" 0
check "dispute: terminal status unchanged by the late open" \
  "$($P -c "SELECT status FROM \"ProcessedWebhook\" WHERE id = 'dispute:dp_conc:ord_conc'")" "$final"
check "dispute: open holds left after close" \
  "$($P -c "SELECT count(*) FROM \"ProcessedWebhook\" WHERE \"orderId\" = 'ord_conc' AND id LIKE 'dispute:%' AND status = 'dispute_open'")" 0

# 4. BUSINESS STATE, not just one row: a `won` handler and a `lost` handler of the same (dispute, order) run in two
#    concurrent transactions. Each one decides from the ledger, applies its EFFECT (recorded in conc_effects — money
#    moved for `lost`, status restored for `won`), then writes its terminal status. With lockDisputeHold's sequence
#    (create-if-missing, no-op write = row lock, re-read) exactly ONE handler acts and the final status is ITS outcome.
#    The plain read the code used before lets BOTH act: contradictory effects, shown here as the defect.
$P -c 'CREATE TABLE IF NOT EXISTS conc_effects (outcome text)'
handler() { # $1 = outcome (won|lost), $2 = lock|nolock
  local lock_sql=""
  [ "$2" = lock ] && lock_sql="UPDATE \"ProcessedWebhook\" SET \"orderId\" = \"orderId\" WHERE id = 'dispute:dp_conc:ord_conc';"
  $P -c "DO \$\$ DECLARE st text; BEGIN
    INSERT INTO \"ProcessedWebhook\" (id, \"orderId\", status, error, \"createdAt\")
      VALUES ('dispute:dp_conc:ord_conc', 'ord_conc', 'dispute_open', NULL, NOW()) ON CONFLICT (id) DO NOTHING;
    $lock_sql
    SELECT status INTO st FROM \"ProcessedWebhook\" WHERE id = 'dispute:dp_conc:ord_conc';
    IF st = 'dispute_open' THEN
      INSERT INTO conc_effects VALUES ('$1');
      PERFORM pg_sleep(0.5);
      UPDATE \"ProcessedWebhook\" SET status = 'dispute_$1' WHERE id = 'dispute:dp_conc:ord_conc';
    END IF;
  END \$\$;"
}
for mode in nolock lock; do
  # The realistic race: the hold was opened earlier by `created`, then `won` and `lost` deliveries meet.
  $P -c "DELETE FROM \"ProcessedWebhook\" WHERE id LIKE 'dispute:dp_conc:%'; TRUNCATE conc_effects;
         INSERT INTO \"ProcessedWebhook\" (id, \"orderId\", status, error, \"createdAt\")
         VALUES ('dispute:dp_conc:ord_conc', 'ord_conc', 'dispute_open', NULL, NOW())"
  (handler won $mode) & (handler lost $mode) & wait
  effects=$($P -c "SELECT count(*) FROM conc_effects")
  final=$($P -c "SELECT status FROM \"ProcessedWebhook\" WHERE id = 'dispute:dp_conc:ord_conc'")
  acted=$($P -c "SELECT string_agg(outcome, ',') FROM conc_effects")
  if [ $mode = nolock ]; then
    check "dispute (OLD plain read): both handlers acted — the defect this PR fixes" "$effects" 2
  else
    check "dispute (lockDisputeHold): exactly one handler acted" "$effects" 1
    check "dispute (lockDisputeHold): the final status is the outcome that acted" "$final" "dispute_$acted"
  fi
done
$P -c 'DROP TABLE conc_effects'

# 5. Fencing: a run that outlived its lease must not create a transfer once another worker took the attempt over.
$P -c "UPDATE \"TransferAttempt\" SET status = 'PENDING', \"lastAttemptAt\" = NOW() - INTERVAL '6 minutes' WHERE id = 'att_conc'"
lease1=$($P -c "SELECT \"lastAttemptAt\" FROM \"TransferAttempt\" WHERE id = 'att_conc'")   # run 1's (now expired) lease
check "fencing: worker 2 claims the expired lease" "$($P -c "$CLAIM" | grep -c att_conc || true)" 1
RENEW1="UPDATE \"TransferAttempt\" SET \"lastAttemptAt\" = NOW() WHERE id = 'att_conc' AND status = 'PENDING' AND \"lastAttemptAt\" = '$lease1' RETURNING id;"
check "fencing: worker 1's renewal before create is refused (it stops)" "$($P -c "$RENEW1" | grep -c att_conc || true)" 0

$P <<'SQL'
DELETE FROM "TransferAttempt" WHERE id = 'att_conc';
DELETE FROM "ProcessedWebhook" WHERE id LIKE 'dispute:dp_conc:%';
SQL
exit $fail
