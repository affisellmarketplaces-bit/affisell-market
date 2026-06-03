-- Supplier trust ladder (Spark / Forge / Orbital badges)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierTrustTier" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierTrustTierAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierSuccessfulOrders" INTEGER NOT NULL DEFAULT 0;
