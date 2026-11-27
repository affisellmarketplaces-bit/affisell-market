#!/usr/bin/env bash
# Migration 20261127120000_supplier_purchase_claim on an ISOLATED local database (created and dropped here):
#   1. a COPY of a local full-schema database (BASE_DB, default "affi") brought back to the previous version (the new
#      table removed), then seed rows in the tables the money paths use. (The repo's migration history cannot be
#      replayed on an EMPTY database: 20260801210000_sponsor_success_fee alters "SponsorCampaign" before any migration
#      creates it — a pre-existing gap, not this migration's.);
#   2. schema dump + row counts BEFORE;
#   3. apply the new migration → no existing table changed, no row lost, constraints present;
#   4. apply it a SECOND time → must fail (no silent re-run, no IF NOT EXISTS) and change nothing;
#   5. rollback to the safe state (DROP TABLE) → schema identical to BEFORE, rows intact.
#
#   PGHOST=/tmp PGPORT=55432 PGUSER=postgres bash scripts/sql/test-supplier-purchase-claim-migration.sh
#
# Local socket / localhost only. Touches no other database.
set -euo pipefail
case "${PGHOST:-}" in /*|localhost|127.0.0.1) ;; *) echo "refused: local PGHOST only"; exit 2 ;; esac
DB="affi_migtest_$$"
NEW="20261127120000_supplier_purchase_claim"
DIR="$(cd "$(dirname "$0")/../.." && pwd)/prisma/migrations"
fail=0
check() { if [ "$2" = "ok" ]; then echo "PASS $1"; else echo "FAIL $1 — $3"; fail=1; fi; }
q() { psql -d "$DB" -qAtX -v ON_ERROR_STOP=1 -c "$1"; }
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT

createdb -T "${BASE_DB:-affi}" "$DB"
q "DROP TABLE IF EXISTS \"SupplierPurchaseClaim\""
q "DELETE FROM \"ProcessedWebhook\" WHERE \"id\" = 'evt_m'"
echo "PASS baseline: isolated copy of ${BASE_DB:-affi} at the previous schema version ($(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'") tables)"

q "INSERT INTO \"User\"(\"id\",\"email\",\"referralCode\") VALUES ('m_s','m_s@t.t','MS1'),('m_a','m_a@t.t','MA1');
   INSERT INTO \"Product\"(\"id\",\"supplierId\",\"name\",\"description\",\"basePriceCents\",\"commissionRate\") VALUES ('m_p','m_s','p','d',1000,10);
   INSERT INTO \"AffiliateProduct\"(\"id\",\"affiliateId\",\"productId\",\"sellingPriceCents\") VALUES ('m_ap','m_a','m_p',1500);
   INSERT INTO \"Order\"(\"id\",\"productId\",\"affiliateProductId\",\"supplierId\",\"affiliateId\",\"customerEmail\",\"shippingAddress\",\"basePriceCents\",\"sellingPriceCents\",\"commissionCents\",\"marginCents\",\"affiliatePayoutCents\",\"stripeSessionId\",\"updatedAt\")
     VALUES ('m_o','m_p','m_ap','m_s','m_a','b@t.t','{}',1000,1500,100,400,100,'cs_m',now());
   INSERT INTO \"FulfillmentProvider\"(\"id\",\"slug\",\"name\",\"channelType\",\"paymentMethod\",\"walletBalanceCents\",\"updatedAt\") VALUES ('m_fp','m_fp','fp','CJ_DROPSHIPPING','WALLET_PREPAID',4200,now());
   INSERT INTO \"ProcessedWebhook\"(\"id\",\"status\") VALUES ('evt_m','success');"

counts() { q "SELECT (SELECT count(*) FROM \"User\")||','||(SELECT count(*) FROM \"Order\")||','||(SELECT count(*) FROM \"FulfillmentProvider\")||','||(SELECT sum(\"walletBalanceCents\") FROM \"FulfillmentProvider\")||','||(SELECT count(*) FROM \"ProcessedWebhook\")"; }
schema() { pg_dump -d "$DB" --schema-only --no-owner --no-privileges | grep -v '^--' | grep -v '^$' | grep -vE '^\\(un)?restrict '; }
# The schema minus every statement that mentions the new table (statements end with ";").
without_new() { python3 -c 'import sys; t=open(sys.argv[1]).read(); print(";".join(x for x in t.split(";") if "SupplierPurchaseClaim" not in x))' "$1"; }
BEFORE_COUNTS=$(counts)
schema > /tmp/mig_before_$$.sql

psql -d "$DB" -qAtX -v ON_ERROR_STOP=1 -f "$DIR/$NEW/migration.sql"
check "migration applies on the previous schema" ok
[ "$(counts)" = "$BEFORE_COUNTS" ] && check "no row lost or changed (users, orders, providers, wallet total, webhooks)" ok || check "rows" ko "$(counts) vs $BEFORE_COUNTS"
schema > /tmp/mig_after_$$.sql
[ "$(without_new /tmp/mig_before_$$.sql)" = "$(without_new /tmp/mig_after_$$.sql)" ] \
  && check "outside the new table the schema is byte-identical (backward compatible: no existing table touched)" ok \
  || check "schema outside the new table" ko "$(diff <(without_new /tmp/mig_before_$$.sql) <(without_new /tmp/mig_after_$$.sql) | head -5)"
[ "$(grep -c SupplierPurchaseClaim /tmp/mig_after_$$.sql)" -gt 0 ] && check "the new table exists" ok || check "new table" ko missing
for c in SupplierPurchaseClaim_pkey SupplierPurchaseClaim_status_check SupplierPurchaseClaim_placed_has_order_check SupplierPurchaseClaim_claimed_has_token_check SupplierPurchaseClaim_paid_cents_check SupplierPurchaseClaim_paid_not_rejected_check; do
  [ "$(q "SELECT count(*) FROM pg_constraint WHERE conname = '$c'")" = "1" ] && check "constraint $c" ok || check "constraint $c" ko missing
done
q "INSERT INTO \"SupplierPurchaseClaim\"(\"id\",\"channel\",\"path\",\"status\",\"token\") VALUES ('order:m_o','cj','t','claimed','tk')"
if q "INSERT INTO \"SupplierPurchaseClaim\"(\"id\",\"channel\",\"path\",\"status\",\"token\") VALUES ('order:m_o','cj','t','claimed','tk2')" >/dev/null 2>&1; then
  check "primary key = one claim per purchase key" ko "duplicate accepted"
else check "primary key = one claim per purchase key" ok; fi

if psql -d "$DB" -qAtX -v ON_ERROR_STOP=1 -f "$DIR/$NEW/migration.sql" >/dev/null 2>&1; then
  check "a second application fails loudly (no IF NOT EXISTS masking drift)" ko "re-applied silently"
else check "a second application fails loudly (no IF NOT EXISTS masking drift)" ok; fi
[ "$(q "SELECT count(*) FROM \"SupplierPurchaseClaim\"")" = "1" ] && check "…and changes nothing" ok || check "re-run changed data" ko ""

# Safe state: the table only holds claims; dropping it brings the schema back exactly (the PREVIOUS code never reads
# it; the NEW code then refuses every purchase — fail-closed). Prefer keeping it: dropping forgets which orders were bought.
q "DROP TABLE \"SupplierPurchaseClaim\""
schema > /tmp/mig_rollback_$$.sql
diff -q /tmp/mig_before_$$.sql /tmp/mig_rollback_$$.sql >/dev/null && check "rollback (DROP TABLE): schema identical to before" ok || check "rollback schema" ko "$(diff /tmp/mig_before_$$.sql /tmp/mig_rollback_$$.sql | head -5)"
[ "$(counts)" = "$BEFORE_COUNTS" ] && check "rollback: every other row intact" ok || check "rollback rows" ko "$(counts)"
rm -f /tmp/mig_before_$$.sql /tmp/mig_after_$$.sql /tmp/mig_rollback_$$.sql
[ $fail -eq 0 ] && echo "ALL PASS" || { echo "FAILED"; exit 1; }
