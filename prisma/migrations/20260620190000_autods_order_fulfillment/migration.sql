-- AutoDS external fulfillment snapshot on marketplace orders
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autodsOrderId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autodsStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autodsTracking" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_autodsOrderId_key" ON "Order"("autodsOrderId");
