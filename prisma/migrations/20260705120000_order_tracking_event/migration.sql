-- Immutable tracking audit trail (litiges + conformité UE)
CREATE TABLE "OrderTrackingEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "trackingCarrier" TEXT,
  "trackingNumber" TEXT,
  "fulfillmentStatus" TEXT,
  "verificationMethod" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderTrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderTrackingEvent_idempotencyKey_key" ON "OrderTrackingEvent"("idempotencyKey");
CREATE INDEX "OrderTrackingEvent_orderId_createdAt_idx" ON "OrderTrackingEvent"("orderId", "createdAt");
CREATE INDEX "OrderTrackingEvent_trackingNumber_idx" ON "OrderTrackingEvent"("trackingNumber");

ALTER TABLE "OrderTrackingEvent"
  ADD CONSTRAINT "OrderTrackingEvent_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
