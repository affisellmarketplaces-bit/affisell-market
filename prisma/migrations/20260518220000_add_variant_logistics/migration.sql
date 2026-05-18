-- P0 logistics & catalog fields on SKU variant rows
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "weightGrams" INTEGER;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "processingDays" INTEGER DEFAULT 2;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "ean" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "originCountry" TEXT DEFAULT 'CN';
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "warehouseCode" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "purchasePriceHT" DECIMAL(10,2);
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "moq" INTEGER DEFAULT 1;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVariant_ean_key" ON "ProductVariant"("ean");
