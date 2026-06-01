-- Snapshot fulfillment channel at checkout (catalogue supplier vs Affisell AE auto-buy).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "usesAffisellAutoBuy" BOOLEAN NOT NULL DEFAULT false;
