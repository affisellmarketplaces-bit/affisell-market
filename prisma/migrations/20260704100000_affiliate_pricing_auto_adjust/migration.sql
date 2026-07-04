-- Affiliate listing: opt-in daily AI variant price adjustments
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "pricingAutoAdjust" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "pricingAutoAdjustLastRun" TIMESTAMP(3);
