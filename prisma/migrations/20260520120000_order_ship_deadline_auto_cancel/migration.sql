-- Ship Pulse: 48h ship-or-cancel deadline + auto-cancel idempotency

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shipDeadlineAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autoCancelledAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_supplierId_status_shipDeadlineAt_idx"
  ON "Order"("supplierId", "status", "shipDeadlineAt");

UPDATE "Order"
SET "shipDeadlineAt" = "paidAt" + INTERVAL '48 hours'
WHERE "shipDeadlineAt" IS NULL
  AND "paidAt" IS NOT NULL
  AND "status" IN ('paid', 'preparing');

UPDATE "Order"
SET "shipDeadlineAt" = "createdAt" + INTERVAL '48 hours'
WHERE "shipDeadlineAt" IS NULL
  AND "status" IN ('paid', 'preparing');
