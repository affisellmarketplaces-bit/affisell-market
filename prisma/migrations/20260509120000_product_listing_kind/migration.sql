-- Affiliate listing kind: PHYSICAL (commission max 99%) vs SOFTWARE/SUBSCRIPTION (up to 100%).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "listingKind" TEXT NOT NULL DEFAULT 'PHYSICAL';
