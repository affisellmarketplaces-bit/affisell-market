-- Ghost Checkout: live supplier stock verification
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierSource" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supplierProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastStockCheck" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastStockStatus" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastPriceSupplier" DECIMAL(65,30);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockCheckFails" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "StockCheckLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "supplierPrice" DECIMAL(65,30),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseTimeMs" INTEGER NOT NULL,
    "source" TEXT,
    CONSTRAINT "StockCheckLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Product_lastStockCheck_idx" ON "Product"("lastStockCheck");
CREATE INDEX IF NOT EXISTS "Product_supplierSource_lastStockStatus_idx" ON "Product"("supplierSource", "lastStockStatus");
CREATE INDEX IF NOT EXISTS "StockCheckLog_productId_checkedAt_idx" ON "StockCheckLog"("productId", "checkedAt");
CREATE INDEX IF NOT EXISTS "StockCheckLog_checkedAt_idx" ON "StockCheckLog"("checkedAt");

DO $$ BEGIN
  ALTER TABLE "StockCheckLog" ADD CONSTRAINT "StockCheckLog_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
