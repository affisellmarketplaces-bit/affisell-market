-- Lock tracking after carrier validation (supplier cannot replace)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingLockedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingVerifiedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Order_trackingLockedAt_idx" ON "Order"("trackingLockedAt");

-- Backfill legacy shipped orders with tracking
UPDATE "Order"
SET
  "trackingLockedAt" = COALESCE("shippedAt", "createdAt"),
  "trackingVerifiedBy" = 'legacy'
WHERE "trackingNumber" IS NOT NULL
  AND "trackingLockedAt" IS NULL
  AND status = 'shipped';
