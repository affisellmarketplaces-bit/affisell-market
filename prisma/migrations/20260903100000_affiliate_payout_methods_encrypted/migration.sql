-- CreateEnum
CREATE TYPE "PayoutMethodType" AS ENUM (
  'BANK',
  'PAYPAL',
  'WISE',
  'PAYONEER',
  'MOBILE_MONEY_WAVE',
  'MOBILE_MONEY_ORANGE',
  'MOBILE_MONEY_MTN'
);

-- CreateEnum
CREATE TYPE "PayoutMethodStatus" AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED',
  'FAILED'
);

-- CreateTable
CREATE TABLE "AffiliatePayoutMethod" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "type" "PayoutMethodType" NOT NULL,
  "country" VARCHAR(2) NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" "PayoutMethodStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "encryptedDetails" TEXT NOT NULL,
  "last4" VARCHAR(10),
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AffiliatePayoutMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePayoutMethod_fingerprint_key" ON "AffiliatePayoutMethod"("fingerprint");

-- CreateIndex
CREATE INDEX "AffiliatePayoutMethod_affiliateId_isDefault_idx" ON "AffiliatePayoutMethod"("affiliateId", "isDefault");

-- CreateIndex
CREATE INDEX "AffiliatePayoutMethod_affiliateId_status_idx" ON "AffiliatePayoutMethod"("affiliateId", "status");

-- AddForeignKey
ALTER TABLE "AffiliatePayoutMethod"
  ADD CONSTRAINT "AffiliatePayoutMethod_affiliateId_fkey"
  FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
