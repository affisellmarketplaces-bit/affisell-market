-- Ship Pulse v2: 10-day window, buyer/supplier thread, extension requests

CREATE TYPE "OrderShipExtensionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

CREATE TABLE "OrderFulfillmentMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderFulfillmentMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderShipExtension" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "extraDays" INTEGER NOT NULL,
    "status" "OrderShipExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "buyerRespondedAt" TIMESTAMP(3),
    "buyerNote" TEXT,
    "newDeadlineAt" TIMESTAMP(3),
    "buyerExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderShipExtension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderFulfillmentMessage_orderId_createdAt_idx" ON "OrderFulfillmentMessage"("orderId", "createdAt");
CREATE INDEX "OrderShipExtension_orderId_status_idx" ON "OrderShipExtension"("orderId", "status");
CREATE INDEX "OrderShipExtension_status_buyerExpiresAt_idx" ON "OrderShipExtension"("status", "buyerExpiresAt");

ALTER TABLE "OrderFulfillmentMessage" ADD CONSTRAINT "OrderFulfillmentMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderShipExtension" ADD CONSTRAINT "OrderShipExtension_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Re-anchor deadlines to 10 days from payment (paidAt added in 20260521140000; use createdAt here)
UPDATE "Order"
SET "shipDeadlineAt" = "createdAt" + INTERVAL '10 days'
WHERE "status" IN ('paid', 'preparing')
  AND "autoCancelledAt" IS NULL;
