-- Lightning Payout: supplier trust profiles, affiliate Connect accounts, order payout state

CREATE TABLE "SupplierProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trustScore" INTEGER NOT NULL DEFAULT 50,
    "lightningEnabled" BOOLEAN NOT NULL DEFAULT false,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplierProfile_userId_key" ON "SupplierProfile"("userId");
CREATE UNIQUE INDEX "SupplierProfile_stripeAccountId_key" ON "SupplierProfile"("stripeAccountId");
CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_stripeAccountId_key" ON "AffiliateProfile"("stripeAccountId");

ALTER TABLE "SupplierProfile" ADD CONSTRAINT "SupplierProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "payoutTransferIds" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "payoutStatus" TEXT NOT NULL DEFAULT 'PENDING';
