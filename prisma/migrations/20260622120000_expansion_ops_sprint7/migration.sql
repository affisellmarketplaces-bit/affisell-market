-- AlterTable
ALTER TABLE "CheckoutLaunchWaitlist" ADD COLUMN "launchFollowUpSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CheckoutCountryRollout" ADD COLUMN "firstOrderAt" TIMESTAMP(3);
ALTER TABLE "CheckoutCountryRollout" ADD COLUMN "firstOrderId" TEXT;

-- CreateIndex
CREATE INDEX "CheckoutCountryRollout_marketRegion_firstOrderAt_idx" ON "CheckoutCountryRollout"("marketRegion", "firstOrderAt");
