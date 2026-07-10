-- Wizard v2: gamification fields on User + MerchantDefault table

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "productStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastProductPublishedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "MerchantDefault" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "countryCode" TEXT,
    "warehouseType" TEXT,
    "offerMode" TEXT,
    "defaultCommissionPct" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantDefault_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantDefault_userId_key" ON "MerchantDefault"("userId");

ALTER TABLE "MerchantDefault" DROP CONSTRAINT IF EXISTS "MerchantDefault_userId_fkey";
ALTER TABLE "MerchantDefault" ADD CONSTRAINT "MerchantDefault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
