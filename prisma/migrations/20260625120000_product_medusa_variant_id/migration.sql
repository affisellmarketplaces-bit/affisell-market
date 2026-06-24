-- Cache Medusa variant id on Affisell Product for order sync
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "medusaVariantId" TEXT;

CREATE INDEX IF NOT EXISTS "Product_medusaVariantId_idx" ON "Product"("medusaVariantId");
