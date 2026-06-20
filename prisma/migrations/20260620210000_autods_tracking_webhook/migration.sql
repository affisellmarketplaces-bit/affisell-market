-- AutoDS tracking fields + fulfillment event log
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autodsTrackingUrl" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autodsCarrier" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autodsShippedEmailSentAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_autodsStatus_createdAt_idx" ON "Order"("autodsStatus", "createdAt");

CREATE TABLE IF NOT EXISTS "AutodsFulfillmentLog" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'autods',
  "event" TEXT NOT NULL,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutodsFulfillmentLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutodsFulfillmentLog_orderId_createdAt_idx" ON "AutodsFulfillmentLog"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AutodsFulfillmentLog" ADD CONSTRAINT "AutodsFulfillmentLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
