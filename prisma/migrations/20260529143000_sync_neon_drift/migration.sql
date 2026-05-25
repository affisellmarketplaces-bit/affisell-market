-- Sync migration history with Neon production (idempotent, no reset).
-- Resolves drift: schema ahead of replayed migrations (ProductVideo, User billing, FKs, defaults).

-- User: pro / video quota / Stripe billing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "videoQuota" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "videoUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPro" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "proActivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- ProductVideo (Meta AI output per product)
CREATE TABLE IF NOT EXISTS "ProductVideo" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVideo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductVideo_productId_key" ON "ProductVideo"("productId");

DO $$ BEGIN
  ALTER TABLE "ProductVideo"
    ADD CONSTRAINT "ProductVideo_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- FulfillmentProvider: supplier link + blind-dropship partner
CREATE INDEX IF NOT EXISTS "FulfillmentProvider_supplierUserId_idx" ON "FulfillmentProvider"("supplierUserId");

DO $$ BEGIN
  ALTER TABLE "FulfillmentProvider"
    ADD CONSTRAINT "FulfillmentProvider_blindDropshipSupplierId_fkey"
    FOREIGN KEY ("blindDropshipSupplierId") REFERENCES "BlindDropshipSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Order → affiliate listing FK (column exists since baseline)
DO $$ BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_affiliateProductId_fkey"
    FOREIGN KEY ("affiliateProductId") REFERENCES "AffiliateProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes / defaults aligned with live Neon
DROP INDEX IF EXISTS "ProductAttribute_value_trgm_idx";
DROP INDEX IF EXISTS "Review_rating_idx";

ALTER TABLE "ProductVariant" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Review" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "VideoGenerationJob" ALTER COLUMN "status" SET DEFAULT 'PROCESSING';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'SupplierFulfillmentOrderLine_supplierFulfillmentOrderId_orderId_key'
      AND n.nspname = 'public'
  ) THEN
    ALTER INDEX "SupplierFulfillmentOrderLine_supplierFulfillmentOrderId_orderId_key"
      RENAME TO "SupplierFulfillmentOrderLine_supplierFulfillmentOrderId_ord_key";
  END IF;
END $$;
