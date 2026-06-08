-- Instant digital delivery (formations, software, subscriptions)

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalAccessUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalAccessInstructions" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "digitalInstantDelivery" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "listingKindSnapshot" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "digitalAccessUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "digitalAccessInstructions" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "digitalAccessToken" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "digitalDeliveredAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_digitalAccessToken_key" ON "Order"("digitalAccessToken");
