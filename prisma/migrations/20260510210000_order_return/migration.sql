-- AlterTable
ALTER TABLE "Order" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "OrderReturn" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "buyerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reasonCode" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "evidenceUrls" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "requestedRefundCents" INTEGER NOT NULL,
    "approvedRefundCents" INTEGER,
    "sellerNote" TEXT,
    "rejectionReason" TEXT,
    "buyerTrackingCarrier" TEXT,
    "buyerTrackingNumber" TEXT,
    "buyerShippedAt" TIMESTAMP(3),
    "sellerRespondByAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderReturn_orderId_idx" ON "OrderReturn"("orderId");

-- CreateIndex
CREATE INDEX "OrderReturn_status_idx" ON "OrderReturn"("status");

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderReturn" ADD CONSTRAINT "OrderReturn_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
