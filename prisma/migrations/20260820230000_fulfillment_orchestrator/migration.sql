-- CreateEnum
CREATE TYPE "FulfillmentGroupStatus" AS ENUM ('PENDING', 'AUTO_BUYING', 'AWAITING_SHIPMENT', 'SHIPPED', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FulfillmentGroup" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierIntegrationId" TEXT,
    "status" "FulfillmentGroupStatus" NOT NULL DEFAULT 'PENDING',
    "externalOrderId" TEXT,
    "trackingNumber" TEXT,
    "trackingCarrier" TEXT,
    "trackingUrl" TEXT,
    "autoBuyPayload" JSONB,
    "autoBuyResponse" JSONB,
    "error" TEXT,
    "manualNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentItem" (
    "id" TEXT NOT NULL,
    "fulfillmentGroupId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FulfillmentGroup_stripeSessionId_idx" ON "FulfillmentGroup"("stripeSessionId");

-- CreateIndex
CREATE INDEX "FulfillmentGroup_supplierId_idx" ON "FulfillmentGroup"("supplierId");

-- CreateIndex
CREATE INDEX "FulfillmentGroup_status_idx" ON "FulfillmentGroup"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentGroup_stripeSessionId_supplierId_key" ON "FulfillmentGroup"("stripeSessionId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentItem_orderId_key" ON "FulfillmentItem"("orderId");

-- CreateIndex
CREATE INDEX "FulfillmentItem_fulfillmentGroupId_idx" ON "FulfillmentItem"("fulfillmentGroupId");

-- AddForeignKey
ALTER TABLE "FulfillmentGroup" ADD CONSTRAINT "FulfillmentGroup_supplierIntegrationId_fkey" FOREIGN KEY ("supplierIntegrationId") REFERENCES "SupplierIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_fulfillmentGroupId_fkey" FOREIGN KEY ("fulfillmentGroupId") REFERENCES "FulfillmentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
