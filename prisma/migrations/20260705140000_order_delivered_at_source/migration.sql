-- Carrier-attested delivery source (UE withdrawal anchor)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveredAtSource" TEXT;

CREATE INDEX IF NOT EXISTS "Order_deliveredAtSource_idx" ON "Order"("deliveredAtSource");

UPDATE "Order"
SET "deliveredAtSource" = 'legacy'
WHERE "deliveredAt" IS NOT NULL
  AND "deliveredAtSource" IS NULL;
