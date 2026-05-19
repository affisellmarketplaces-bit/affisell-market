-- AlterTable
ALTER TABLE "AffiliateProduct" ADD COLUMN "promotedVariantKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
