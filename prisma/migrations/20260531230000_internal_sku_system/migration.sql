-- Internal Affisell SKU + manual AE variant mapping
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "affisellSku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variantMapping" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoBuyEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_affisellSku_key" ON "Product"("affisellSku");

ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "supplierSku" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "wholesalePriceCents" INTEGER;
