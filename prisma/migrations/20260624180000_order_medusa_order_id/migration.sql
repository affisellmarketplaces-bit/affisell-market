-- Medusa v2 order mirror id (Stripe Affisell → Medusa admin sync)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "medusaOrderId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_medusaOrderId_key" ON "Order"("medusaOrderId");
