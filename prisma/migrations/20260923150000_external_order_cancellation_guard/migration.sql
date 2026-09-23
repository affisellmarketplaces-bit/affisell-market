-- Money-loss guard: when a refund lands on an order whose upstream (AliExpress/CJ/…)
-- purchase was already placed, we now attempt to cancel it externally instead of silently
-- eating the wholesale cost. Tracks the outcome on both fulfillment paths (legacy AE
-- auto-buy via FulfillmentLog, generic multi-provider engine via SupplierFulfillmentOrder).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExternalCancelStatus') THEN
    CREATE TYPE "ExternalCancelStatus" AS ENUM (
      'NOT_ATTEMPTED',
      'CANCELLED',
      'MANUAL_REQUIRED',
      'FAILED'
    );
  END IF;
END $$;

ALTER TABLE "FulfillmentLog"
  ADD COLUMN IF NOT EXISTS "externalCancelStatus" "ExternalCancelStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
  ADD COLUMN IF NOT EXISTS "externalCancelAttemptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "externalCancelNote" TEXT;

CREATE INDEX IF NOT EXISTS "FulfillmentLog_externalCancelStatus_idx"
  ON "FulfillmentLog"("externalCancelStatus");

ALTER TABLE "SupplierFulfillmentOrder"
  ADD COLUMN IF NOT EXISTS "externalCancelStatus" "ExternalCancelStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
  ADD COLUMN IF NOT EXISTS "externalCancelAttemptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "externalCancelNote" TEXT;

CREATE INDEX IF NOT EXISTS "SupplierFulfillmentOrder_externalCancelStatus_idx"
  ON "SupplierFulfillmentOrder"("externalCancelStatus");
