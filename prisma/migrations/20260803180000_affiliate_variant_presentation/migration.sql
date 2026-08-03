-- Affiliate listing-only variant name + photo overrides (does not touch Product.colorImages).
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "variantPresentation" JSONB;
