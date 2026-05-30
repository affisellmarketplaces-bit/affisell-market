-- CreateEnum
CREATE TYPE "AutoBuyStatus" AS ENUM ('PENDING', 'BUYING', 'BOUGHT', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "SupplierLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "aeProductId" TEXT NOT NULL,
    "aeSkuId" TEXT,
    "aeShopId" TEXT NOT NULL DEFAULT '',
    "aePriceCents" INTEGER NOT NULL,
    "aeShippingCents" INTEGER NOT NULL DEFAULT 0,
    "aeUrl" TEXT NOT NULL,
    "autoBuyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentLog" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "AutoBuyStatus" NOT NULL DEFAULT 'PENDING',
    "aeOrderId" TEXT,
    "aeTracking" TEXT,
    "virtualCardId" TEXT,
    "errorMsg" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierLink_productId_key" ON "SupplierLink"("productId");

-- CreateIndex
CREATE INDEX "SupplierLink_aeProductId_idx" ON "SupplierLink"("aeProductId");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentLog_orderId_key" ON "FulfillmentLog"("orderId");

-- CreateIndex
CREATE INDEX "FulfillmentLog_status_idx" ON "FulfillmentLog"("status");

-- AddForeignKey
ALTER TABLE "SupplierLink" ADD CONSTRAINT "SupplierLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentLog" ADD CONSTRAINT "FulfillmentLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill SupplierLink from existing AliExpress product fields
INSERT INTO "SupplierLink" (
    "id",
    "productId",
    "aeProductId",
    "aeSkuId",
    "aeShopId",
    "aePriceCents",
    "aeShippingCents",
    "aeUrl",
    "autoBuyEnabled",
    "isActive",
    "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    p."id",
    p."aliexpressProductId",
    p."sourceSkuId",
    '',
    GREATEST(100, p."basePriceCents"),
    0,
    COALESCE(NULLIF(TRIM(p."sourceUrl"), ''), 'https://www.aliexpress.com/item/' || p."aliexpressProductId" || '.html'),
    p."autoFulfill",
    true,
    CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."aliexpressProductId" IS NOT NULL
  AND TRIM(p."aliexpressProductId") <> ''
ON CONFLICT ("productId") DO NOTHING;
