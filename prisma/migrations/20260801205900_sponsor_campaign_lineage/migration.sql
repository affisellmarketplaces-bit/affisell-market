-- LINEAGE REPAIR (written 2026-11-24, dated just before 20260801210000_sponsor_success_fee on purpose).
--
-- "SponsorCampaign" was never created by a migration: the table reached the shared databases outside the migration
-- chain (the repository's `db:push` script / the former self-healing pipeline — see docs/MIGRATION-LINEAGE.md), and
-- 20260801210000 only ALTERs it. A database built from the migrations alone therefore failed at 20260801210000.
--
-- This migration creates the table in the shape it had BEFORE 20260801210000 (without "billingMode" /
-- "accruedFeeCents", which that migration adds). Every statement is guarded (IF NOT EXISTS / pg_constraint check):
-- on a database where the table already exists it changes nothing; Prisma records it as applied.
CREATE TABLE IF NOT EXISTS "SponsorCampaign" (
  "id" TEXT NOT NULL,
  "payerUserId" TEXT NOT NULL,
  "payerRole" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "affiliateProductId" TEXT,
  "sponsorRateBps" INTEGER NOT NULL,
  "htCentsSnapshot" INTEGER NOT NULL,
  "feeCents" INTEGER NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "placement" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
  "boostScore" INTEGER NOT NULL DEFAULT 0,
  "setsListingFeatured" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SponsorCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SponsorCampaign_stripeCheckoutSessionId_key" ON "SponsorCampaign"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "SponsorCampaign_stripePaymentIntentId_key" ON "SponsorCampaign"("stripePaymentIntentId");
CREATE INDEX IF NOT EXISTS "SponsorCampaign_status_endsAt_idx" ON "SponsorCampaign"("status", "endsAt");
CREATE INDEX IF NOT EXISTS "SponsorCampaign_affiliateProductId_status_idx" ON "SponsorCampaign"("affiliateProductId", "status");
CREATE INDEX IF NOT EXISTS "SponsorCampaign_productId_status_payerRole_idx" ON "SponsorCampaign"("productId", "status", "payerRole");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SponsorCampaign_payerUserId_fkey') THEN
    ALTER TABLE "SponsorCampaign" ADD CONSTRAINT "SponsorCampaign_payerUserId_fkey"
      FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SponsorCampaign_productId_fkey') THEN
    ALTER TABLE "SponsorCampaign" ADD CONSTRAINT "SponsorCampaign_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SponsorCampaign_affiliateProductId_fkey') THEN
    ALTER TABLE "SponsorCampaign" ADD CONSTRAINT "SponsorCampaign_affiliateProductId_fkey"
      FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
