-- Per-variant affiliate selling prices (keyed by promoted variant label).
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "variantPricing" JSONB;
