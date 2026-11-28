# Read-only operational checks — before and after each money-path deploy

Every command below **only reads**:

- Stripe: LIST calls only.
- Database: a session the server keeps read-only (`default_transaction_read_only=on`), or plain SELECTs.

Each one takes its credentials **explicitly**; `.env*` files are never read. Nothing here is "verified in production"
until it has actually been run against production data, with its output kept.

Commands marked †: `#34`, `#31` and `#30` provide them — available once those PRs are merged (they are all present on
the integration branch `#37`).

```bash
export DATABASE_URL='<prod or staging url>'   # pooled URL is fine: read-only session
export STRIPE_SECRET_KEY='sk_test_…'           # rk_ (restricted, read-only) keys work too and are preferred
```

| #   | What                                                                                                                                                     | Command                                                                                            | Exit / reading                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1   | Impact of the default purchase lock (#35): products and paid orders that depend on an automatic supplier purchase                                        | `npm run report:supplier-purchase-impact`                                                          | 0; read the counts **before** deploying #35 |
| 2   | One payout verdict: key mode, webhooks, ledger invariants, Stripe duplicates, Stripe ↔ ledger, refunds, disputes, webhook freshness, supplier payments † | `npm run preflight:payouts -- --days 120`                                                          | 0 PASS · 1 WARNING · 2 BLOCKED              |
| 3   | Ledger invariants alone (paid > payable, two rails, paid after a dispute…) †                                                                             | `npm run report:money-invariants -- --days 120`                                                    | 0 clean · 1 medium/low · 2 critical/high    |
| 4   | Duplicate Stripe transfers (same beneficiary paid twice for one order) †                                                                                 | `npm run report:stripe-duplicates -- --days 365`                                                   | 2 = duplicates found                        |
| 5   | Webhook endpoint subscribed to the 13 required events †                                                                                                  | `npm run verify:stripe-webhooks`                                                                   | 0 all · 2 a money event missing             |
| 6   | Supplier purchases needing a human (uncertain, stuck, paid-not-placed)                                                                                   | `npm run report:supplier-purchase-claims`                                                          | 0 nothing · 2 decisions needed              |
| 7   | Resolve ONE such claim (dry-run unless `--apply`; production-guarded)                                                                                    | `npm run resolve:supplier-purchase-claim -- --key order:<id> --as placed --supplier-order <id>`    | —                                           |
| 8   | Fulfilment channels: which products can be paid right now                                                                                                | the `[checkout-deliverability]` log lines, or `GET /api/checkout/deliverability?ids=<listing ids>` | lists listing ids that checkout refuses     |
| 9   | Schema really migrated (catalog, not only `migrate status`)                                                                                              | `npm run schema:verify`                                                                            | 0 · 5 missing                               |

## Order of use around a deploy

1. **Before**:
   - 1, then 2 (and 3–5 if 2 is not PASS);
   - 9 against the target database after `schema:migrate` (owner).
2. **Deploy** (owner).
3. **After**:
   - 2 again;
   - 6;
   - watch the `[supplier-purchase]`, `[checkout-deliverability]` and `[subscription-state]` logs for an hour.

## Migration `SupplierPurchaseClaim` — staging first (owner)

**What it is**: `20261127120000_supplier_purchase_claim` (27 lines; final content since `c5354ce76`; sha256
`8acb15a1dbbffdcc387a7010a9cb76bfa542756996853fe1ea0b4a1f84b3efec`).
- It creates ONE new table, with no foreign key, 5 CHECK constraints and one index.
- It touches no existing table: there is no lock on live tables and no backfill. It runs in milliseconds.
- The previous code never reads this table, so the migration is safe to apply BEFORE the code that uses it.

0. **Read-only pre-checks** (staging URL in the environment only, never in a file):
   ```
   export DATABASE_URL='<staging pooled>' DIRECT_URL='<staging direct>'
   export PGOPTIONS="-c default_transaction_read_only=on"   # the server refuses any write from these psql checks
   node scripts/prisma-explicit-db.mjs status          # expect: exactly 1 pending = 20261127120000_supplier_purchase_claim, 0 failed
   psql "$DIRECT_URL" -Atc "SELECT to_regclass('\"SupplierPurchaseClaim\"')"                        # expect: empty (table absent)
   psql "$DIRECT_URL" -Atc "SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name LIKE '20261127%'"   # expect: no row
   ```
   **Interpretation**:
   - If the table exists while the migration is not recorded, **STOP**: someone created it by hand, so compare it with
     the SQL above.
   - If a row exists with a checksum other than `8acb15a1…`, the first version (`a9e922fb5`, without
     `token` / `paidCents`) was applied. **STOP**: do not re-apply, and ask Claude for a forward migration.
1. **Back up**: in the Neon console, create a branch from the staging branch `ep-shy-wind-…` and name it
   `staging-before-20261127`. This is instant and free, and it is the restore point.
2. **Apply** (owner, explicit approval):
   ```
   npm run schema:migrate -- --expect-endpoint ep-shy-wind-<rest>
   ```
   It refuses unless Prisma itself names that endpoint, runs `migrate deploy`, then checks the status again and the
   catalogue. **Exit codes**:
   - 0: OK;
   - 2: refused;
   - 3: target not proven;
   - 4: the migration failed. See §6 of `DEPLOY-SCHEMA-CHANGES.md`: `resolve --rolled-back`, never `--applied`.
3. **Post-checks**:
   - `npm run schema:verify` → 0;
   - `psql "$DIRECT_URL" -Atc "SELECT count(*) FROM pg_constraint WHERE conrelid='\"SupplierPurchaseClaim\"'::regclass AND contype='c'"` → `5`;
   - `npm run report:supplier-purchase-claims` → exit 0, no claim.
4. **Fail-closed check**: with `SUPPLIER_PURCHASES_ENABLED` unset on the Preview, any purchase attempt logs
   `[supplier-purchase] blocked_by_policy`. With a channel listed but no `SUPPLIER_PURCHASE_DAILY_LIMITS` entry, the log
   says `daily_limit_absent`.
5. **Production**: only after a separate approval. Same steps, with `--expect-endpoint ep-misty-sea-<rest>
   --confirm-production`, a Neon branch `prod-before-20261127` first, and `report:supplier-purchase-impact` before it.
6. **Rollback**:
   - Normal case: keep the table (it is inert) and keep the policy closed. The old code works with or without it.
   - `DROP TABLE "SupplierPurchaseClaim"` is safe only while it holds no row; check with `SELECT count(*)` first.
   - Restoring the Neon branch from step 1 is the last resort: it loses every write made since.

Proof that the migration is safe (isolated copy, 16/16): `scripts/sql/test-supplier-purchase-claim-migration.sh`. Full
procedure and consequences: `docs/SUPPLIER-PURCHASES.md` §3–5.
