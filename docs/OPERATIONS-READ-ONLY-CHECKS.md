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

1. **Back up**: in the Neon console, create a branch (or snapshot) of the staging branch `ep-shy-wind-…` — instant,
   free, and it is the restore point.
2. Run:
   ```
   DATABASE_URL='<staging>' DIRECT_URL='<staging direct>' npm run schema:migrate -- --expect-endpoint ep-shy-wind-<rest>
   ```
   It refuses unless Prisma itself names that endpoint.
3. `npm run schema:verify` → 0.
4. **Fail-closed check on staging** (also: with a channel listed but no `SUPPLIER_PURCHASE_DAILY_LIMITS` entry, the
   log must say `daily_limit_absent`): with `SUPPLIER_PURCHASES_ENABLED` unset, `npm run report:supplier-purchase-claims`
   → 0 open claims. The first Preview built on it must show `[supplier-purchase] blocked_by_policy` for any purchase
   attempt.
5. Only after approval: the same steps on production, with `--confirm-production`.
6. **Rollback**: keep the table, close the policy. Restoring the Neon branch from step 1 is the last resort; it loses
   every write made since.

Proof that the migration is safe (isolated copy, 16/16): `scripts/sql/test-supplier-purchase-claim-migration.sh`. Full
procedure and consequences: `docs/SUPPLIER-PURCHASES.md` §3–5.
