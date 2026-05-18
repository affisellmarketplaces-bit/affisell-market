-- AlterTable
ALTER TABLE "Product" ADD COLUMN "customColumns" JSONB;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN "customData" JSONB;
