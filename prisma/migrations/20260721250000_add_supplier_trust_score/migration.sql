-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trustScore" INTEGER NOT NULL DEFAULT 75;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isTopSupplier" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "User_trustScore_idx" ON "User"("trustScore");
CREATE INDEX IF NOT EXISTS "User_isTopSupplier_idx" ON "User"("isTopSupplier");

-- CreateTable SupplierMetrics
CREATE TABLE IF NOT EXISTS "SupplierMetrics" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "onTimeDeliveries" INTEGER NOT NULL DEFAULT 0,
    "avgDeliveryDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promisedVsActualDelta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trustScore" INTEGER NOT NULL DEFAULT 75,
    "deliveryScore" INTEGER NOT NULL DEFAULT 75,
    "responseTimeAvg" INTEGER NOT NULL DEFAULT 0,
    "disputeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierMetrics_supplierId_key" ON "SupplierMetrics"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierMetrics_trustScore_idx" ON "SupplierMetrics"("trustScore");
CREATE INDEX IF NOT EXISTS "SupplierMetrics_deliveryScore_idx" ON "SupplierMetrics"("deliveryScore");

-- CreateTable DeliveryReview
CREATE TABLE IF NOT EXISTS "DeliveryReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "requestId" TEXT,
    "quoteId" TEXT,
    "supplierId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "promisedDays" INTEGER NOT NULL,
    "actualDays" INTEGER NOT NULL,
    "isOnTime" BOOLEAN NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryReview_resellerId_quoteId_key" ON "DeliveryReview"("resellerId", "quoteId");
CREATE INDEX IF NOT EXISTS "DeliveryReview_supplierId_idx" ON "DeliveryReview"("supplierId");
CREATE INDEX IF NOT EXISTS "DeliveryReview_isOnTime_idx" ON "DeliveryReview"("isOnTime");
CREATE INDEX IF NOT EXISTS "DeliveryReview_resellerId_createdAt_idx" ON "DeliveryReview"("resellerId", "createdAt");
