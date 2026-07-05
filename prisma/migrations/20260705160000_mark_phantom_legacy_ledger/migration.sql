-- Mark pre-unification phantom ledger rows (payout:* without Stripe transfer).

UPDATE "MerchantPayoutLedger"
SET
  "payoutRail" = 'phantom_legacy',
  "note" = COALESCE("note", '') || ' [phantom_legacy: pre-unification cron, no Stripe transfer]'
WHERE "entryType" = 'PAYOUT'
  AND "orderId" IS NOT NULL
  AND "blindDropshipOrderId" IS NULL
  AND "stripeTransferId" IS NULL
  AND "payoutRail" NOT IN ('phantom_legacy')
  AND (
    "idempotencyKey" LIKE 'payout:supplier:%'
    OR "idempotencyKey" LIKE 'payout:affiliate:%'
  );
