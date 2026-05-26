-- Legal signup consent + cookie preferences + supplier revenue visibility for affiliates.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "privacyAcceptedVersion" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cookieConsent" JSONB;

ALTER TABLE "Store" ADD COLUMN IF NOT EXISTS "showRevenueToAffiliate" BOOLEAN NOT NULL DEFAULT false;
