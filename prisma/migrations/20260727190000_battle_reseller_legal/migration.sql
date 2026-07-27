-- Pulse Battle legal: reseller-controlled flash % + 30d price reference (DGCCRF)

ALTER TABLE "PulseBattle" ADD COLUMN IF NOT EXISTS "flashDiscountSetBy" TEXT;
ALTER TABLE "PulseBattle" ADD COLUMN IF NOT EXISTS "priceReferenceCents" INTEGER;
ALTER TABLE "PulseBattle" ADD COLUMN IF NOT EXISTS "priceReferenceSource" TEXT DEFAULT 'lowest_30d';

CREATE TABLE IF NOT EXISTS "PriceHistory" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PriceHistory_listingId_createdAt_idx" ON "PriceHistory"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "PriceHistory_listingId_idx" ON "PriceHistory"("listingId");
