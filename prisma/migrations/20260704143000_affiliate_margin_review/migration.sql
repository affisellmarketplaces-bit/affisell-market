ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "marginReviewNeeded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "marginReviewAt" TIMESTAMP(3);
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "marginReviewVariantKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "marginReviewAlertHash" TEXT;
