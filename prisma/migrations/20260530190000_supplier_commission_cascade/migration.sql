-- Category + supplier defaults for supplier → affiliate commission cascade (bps).
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "supplierCommissionRateBps" INTEGER;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultSupplierCommissionRateBps" INTEGER;
