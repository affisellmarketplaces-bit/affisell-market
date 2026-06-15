-- CreateTable
CREATE TABLE "CheckoutLaunchWaitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "countryIso2" TEXT NOT NULL,
    "marketRegion" TEXT NOT NULL,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutLaunchWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLaunchWaitlist_email_countryIso2_marketRegion_key" ON "CheckoutLaunchWaitlist"("email", "countryIso2", "marketRegion");

-- CreateIndex
CREATE INDEX "CheckoutLaunchWaitlist_countryIso2_marketRegion_idx" ON "CheckoutLaunchWaitlist"("countryIso2", "marketRegion");

-- CreateIndex
CREATE INDEX "CheckoutLaunchWaitlist_marketRegion_createdAt_idx" ON "CheckoutLaunchWaitlist"("marketRegion", "createdAt");
