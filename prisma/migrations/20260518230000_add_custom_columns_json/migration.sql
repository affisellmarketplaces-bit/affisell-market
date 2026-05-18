-- Custom column definitions on product + per-SKU values (after ProductVariant table exists)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customColumns" JSONB;

ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "customData" JSONB;
