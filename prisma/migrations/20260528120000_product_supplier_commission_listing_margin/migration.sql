-- AlterTable
ALTER TABLE "Product" ADD COLUMN "supplierCommissionRateBps" INTEGER;

-- AlterTable
ALTER TABLE "AffiliateProduct" ADD COLUMN "marginCents" INTEGER NOT NULL DEFAULT 0;
