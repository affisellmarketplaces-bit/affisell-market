-- AffiliateSale legal snapshot (L132-1) + Order.pricingFreedom

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "pricingFreedom" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AffiliateSale" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierPriceCents" INTEGER NOT NULL,
    "marginAmountCents" INTEGER NOT NULL,
    "commissionAmountCents" INTEGER NOT NULL,
    "resalePriceCents" INTEGER NOT NULL,
    "pricingFreedom" BOOLEAN NOT NULL DEFAULT true,
    "legalQualification" TEXT NOT NULL DEFAULT 'COMMISSIONNAIRE_AFFILIE_L132-1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateSale_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateSale_orderId_key" ON "AffiliateSale"("orderId");
CREATE INDEX IF NOT EXISTS "AffiliateSale_affiliateId_idx" ON "AffiliateSale"("affiliateId");
CREATE INDEX IF NOT EXISTS "AffiliateSale_supplierId_idx" ON "AffiliateSale"("supplierId");

ALTER TABLE "AffiliateSale" DROP CONSTRAINT IF EXISTS "AffiliateSale_orderId_fkey";
ALTER TABLE "AffiliateSale" ADD CONSTRAINT "AffiliateSale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
