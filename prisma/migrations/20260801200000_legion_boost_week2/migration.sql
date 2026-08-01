-- Affisell LÉGION BOOST week 2 — Prisma/Neon (cuid ids)

CREATE TABLE IF NOT EXISTS "LegionBoost" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productTitle" TEXT,
  "oldMarginRate" DECIMAL(5,4) NOT NULL DEFAULT 0.30,
  "boostMarginRate" DECIMAL(5,4) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "armyNotifiedCount" INTEGER NOT NULL DEFAULT 0,
  "boostSalesCount" INTEGER NOT NULL DEFAULT 0,
  "boostGmv" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegionBoost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegionBoost_status_check" CHECK ("status" IN ('active', 'expired', 'cancelled')),
  CONSTRAINT "LegionBoost_margin_check" CHECK ("boostMarginRate" >= 0.35 AND "boostMarginRate" <= 0.50)
);

CREATE INDEX IF NOT EXISTS "LegionBoost_status_endsAt_idx" ON "LegionBoost"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "LegionBoost_productId_status_idx" ON "LegionBoost"("productId", "status");
CREATE INDEX IF NOT EXISTS "LegionBoost_supplierId_idx" ON "LegionBoost"("supplierId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LegionBoost_supplierId_fkey'
  ) THEN
    ALTER TABLE "LegionBoost"
      ADD CONSTRAINT "LegionBoost_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- expire_boosts() — same semantics as supabase spec (returns count)
CREATE OR REPLACE FUNCTION expire_boosts()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE "LegionBoost"
  SET "status" = 'expired'
  WHERE "status" = 'active'
    AND "endsAt" <= NOW();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
