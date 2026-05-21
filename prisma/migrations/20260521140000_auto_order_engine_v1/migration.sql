-- Universal Auto-Order Engine v1

CREATE TYPE "SupplierChannelType" AS ENUM (
  'AFFISELL_NATIVE',
  'ALIEXPRESS',
  'CJ_DROPSHIPPING',
  'TEMU',
  'BIGBUY',
  'ZENDROP',
  'AMAZON',
  'TIKTOK_SHOP',
  'BLIND_REST',
  'MANUAL'
);

CREATE TYPE "FulfillmentProviderStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISABLED');
CREATE TYPE "FulfillmentPaymentMethod" AS ENUM ('STRIPE_ISSUING', 'STRIPE_CONNECT', 'WALLET_PREPAID', 'INVOICE_NET30', 'NONE');
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARTIAL', 'ORDERED', 'SHIPPED', 'DELIVERED', 'FAILED', 'MANUAL_REQUIRED');
CREATE TYPE "SupplierFulfillmentStatus" AS ENUM ('PENDING', 'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED');
CREATE TYPE "AutoFulfillmentBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "autoFulfill" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fulfillmentChannel" "SupplierChannelType";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sourceProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sourceSkuId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "fulfillmentDelayHours" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "minMarginBps" INTEGER NOT NULL DEFAULT 1500;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfillmentErrors" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "fulfilledAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "autoFulfillmentBatchId" TEXT;

CREATE TABLE IF NOT EXISTS "FulfillmentProvider" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelType" "SupplierChannelType" NOT NULL,
    "status" "FulfillmentProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiConfig" JSONB NOT NULL DEFAULT '{}',
    "credentialsEncrypted" TEXT,
    "paymentMethod" "FulfillmentPaymentMethod" NOT NULL DEFAULT 'NONE',
    "stripeConnectAccountId" TEXT,
    "commissionRateBps" INTEGER NOT NULL DEFAULT 0,
    "walletBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "metadata" JSONB,
    "supplierUserId" TEXT,
    "blindDropshipSupplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FulfillmentProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FulfillmentProvider_slug_key" ON "FulfillmentProvider"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "FulfillmentProvider_blindDropshipSupplierId_key" ON "FulfillmentProvider"("blindDropshipSupplierId");
CREATE INDEX IF NOT EXISTS "FulfillmentProvider_channelType_status_idx" ON "FulfillmentProvider"("channelType", "status");

CREATE TABLE IF NOT EXISTS "AutoFulfillmentBatch" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "status" "AutoFulfillmentBatchStatus" NOT NULL DEFAULT 'PENDING',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "supplierJobCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutoFulfillmentBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutoFulfillmentBatch_stripeSessionId_key" ON "AutoFulfillmentBatch"("stripeSessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "AutoFulfillmentBatch_idempotencyKey_key" ON "AutoFulfillmentBatch"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AutoFulfillmentBatch_status_createdAt_idx" ON "AutoFulfillmentBatch"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "SupplierFulfillmentOrder" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "fulfillmentProviderId" TEXT NOT NULL,
    "supplierOrderId" TEXT,
    "status" "SupplierFulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentMethod" "FulfillmentPaymentMethod" NOT NULL,
    "paymentReference" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "SupplierFulfillmentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierFulfillmentOrder_supplierOrderId_key" ON "SupplierFulfillmentOrder"("supplierOrderId");
CREATE INDEX IF NOT EXISTS "SupplierFulfillmentOrder_batchId_idx" ON "SupplierFulfillmentOrder"("batchId");
CREATE INDEX IF NOT EXISTS "SupplierFulfillmentOrder_fulfillmentProviderId_status_idx" ON "SupplierFulfillmentOrder"("fulfillmentProviderId", "status");

CREATE TABLE IF NOT EXISTS "SupplierFulfillmentOrderLine" (
    "id" TEXT NOT NULL,
    "supplierFulfillmentOrderId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL,
    "supplierSku" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    CONSTRAINT "SupplierFulfillmentOrderLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierFulfillmentOrderLine_supplierFulfillmentOrderId_orderId_key" ON "SupplierFulfillmentOrderLine"("supplierFulfillmentOrderId", "orderId");
CREATE INDEX IF NOT EXISTS "SupplierFulfillmentOrderLine_orderId_idx" ON "SupplierFulfillmentOrderLine"("orderId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_autoFulfillmentBatchId_fkey" FOREIGN KEY ("autoFulfillmentBatchId") REFERENCES "AutoFulfillmentBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillmentOrder" ADD CONSTRAINT "SupplierFulfillmentOrder_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AutoFulfillmentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillmentOrder" ADD CONSTRAINT "SupplierFulfillmentOrder_fulfillmentProviderId_fkey" FOREIGN KEY ("fulfillmentProviderId") REFERENCES "FulfillmentProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillmentOrderLine" ADD CONSTRAINT "SupplierFulfillmentOrderLine_supplierFulfillmentOrderId_fkey" FOREIGN KEY ("supplierFulfillmentOrderId") REFERENCES "SupplierFulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierFulfillmentOrderLine" ADD CONSTRAINT "SupplierFulfillmentOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Order" SET "paidAt" = "createdAt" WHERE "paidAt" IS NULL AND "status" = 'paid';
