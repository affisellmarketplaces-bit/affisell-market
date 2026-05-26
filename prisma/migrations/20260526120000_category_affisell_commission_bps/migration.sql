-- Affisell platform commission rate per category (+ optional product override).
ALTER TABLE "Category" ADD COLUMN "affisellCommissionRateBps" INTEGER;

ALTER TABLE "Product" ADD COLUMN "affisellCommissionRateOverrideBps" INTEGER;

-- Backfill: explicit 10% on all categories (matches legacy AFFISELL_MARKETPLACE_FEE_PERCENT).
UPDATE "Category" SET "affisellCommissionRateBps" = 1000 WHERE "affisellCommissionRateBps" IS NULL;
