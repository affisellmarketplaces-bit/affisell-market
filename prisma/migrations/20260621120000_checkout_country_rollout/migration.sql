-- AlterTable
ALTER TABLE "CheckoutLaunchWaitlist" ADD COLUMN "launchNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CheckoutLaunchWaitlist_countryIso2_marketRegion_launchNotifiedAt_idx" ON "CheckoutLaunchWaitlist"("countryIso2", "marketRegion", "launchNotifiedAt");

-- CreateTable
CREATE TABLE "CheckoutCountryRollout" (
    "id" TEXT NOT NULL,
    "countryIso2" TEXT NOT NULL,
    "marketRegion" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "launchEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutCountryRollout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutCountryRollout_countryIso2_marketRegion_key" ON "CheckoutCountryRollout"("countryIso2", "marketRegion");

-- CreateIndex
CREATE INDEX "CheckoutCountryRollout_marketRegion_enabled_idx" ON "CheckoutCountryRollout"("marketRegion", "enabled");
