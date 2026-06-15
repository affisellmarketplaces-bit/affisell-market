-- AlterTable
ALTER TABLE "CheckoutCountryRollout" ADD COLUMN "graduatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CheckoutCountryRollout_marketRegion_graduatedAt_idx" ON "CheckoutCountryRollout"("marketRegion", "graduatedAt");
