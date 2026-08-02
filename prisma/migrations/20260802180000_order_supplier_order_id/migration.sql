-- AlterTable
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "supplierOrderId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Order_supplierOrderId_idx" ON "Order"("supplierOrderId");
