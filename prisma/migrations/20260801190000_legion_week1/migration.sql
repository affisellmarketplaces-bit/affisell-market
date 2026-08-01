-- Affisell LÉGION week 1 — Prisma/Neon (cuid Text ids, additive Order columns)

CREATE TABLE IF NOT EXISTS "StoreProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "displayName" TEXT,
  "bio" TEXT,
  "avatarUrl" TEXT,
  "tiktokUrl" TEXT,
  "instagramUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "totalSales" INTEGER NOT NULL DEFAULT 0,
  "totalEarnings" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreProfile_username_format" CHECK ("username" ~ '^[a-z0-9_]{3,20}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "StoreProfile_userId_key" ON "StoreProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "StoreProfile_username_key" ON "StoreProfile"("username");
CREATE INDEX IF NOT EXISTS "StoreProfile_username_idx" ON "StoreProfile"("username");
CREATE INDEX IF NOT EXISTS "StoreProfile_userId_idx" ON "StoreProfile"("userId");

CREATE TABLE IF NOT EXISTS "LegionReferral" (
  "id" TEXT NOT NULL,
  "sponsorId" TEXT NOT NULL,
  "referredId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "overrideRate" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
  "totalOverrideEarned" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LegionReferral_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LegionReferral_status_check" CHECK ("status" IN ('active', 'blocked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "LegionReferral_referredId_key" ON "LegionReferral"("referredId");
CREATE INDEX IF NOT EXISTS "LegionReferral_sponsorId_idx" ON "LegionReferral"("sponsorId");
CREATE INDEX IF NOT EXISTS "LegionReferral_referredId_idx" ON "LegionReferral"("referredId");

ALTER TABLE "StoreProfile"
  ADD CONSTRAINT "StoreProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegionReferral"
  ADD CONSTRAINT "LegionReferral_sponsorId_fkey"
  FOREIGN KEY ("sponsorId") REFERENCES "StoreProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LegionReferral"
  ADD CONSTRAINT "LegionReferral_referredId_fkey"
  FOREIGN KEY ("referredId") REFERENCES "StoreProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Additive Order columns — do not redefine payoutStatus used by Lightning/Connect
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "storeProfileId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legionOverrideAmount" DECIMAL(14,2) DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legionPayoutStatus" TEXT DEFAULT 'pending';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legionPayoutDueAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legionSupplierAmount" DECIMAL(14,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legionReserveAmount" DECIMAL(14,2);

CREATE INDEX IF NOT EXISTS "Order_storeProfileId_idx" ON "Order"("storeProfileId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Order_storeProfileId_fkey'
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_storeProfileId_fkey"
      FOREIGN KEY ("storeProfileId") REFERENCES "StoreProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
