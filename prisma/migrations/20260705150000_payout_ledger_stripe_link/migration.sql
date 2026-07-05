-- Unify payout audit: link MerchantPayoutLedger to Stripe transfers.

ALTER TABLE "MerchantPayoutLedger" ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT;
ALTER TABLE "MerchantPayoutLedger" ADD COLUMN IF NOT EXISTS "payoutRail" TEXT NOT NULL DEFAULT 'ledger_only';

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantPayoutLedger_stripeTransferId_key"
  ON "MerchantPayoutLedger"("stripeTransferId")
  WHERE "stripeTransferId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "MerchantPayoutLedger_payoutRail_createdAt_idx"
  ON "MerchantPayoutLedger"("payoutRail", "createdAt");
