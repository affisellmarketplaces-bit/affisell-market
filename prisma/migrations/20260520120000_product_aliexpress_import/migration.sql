-- AlterTable
ALTER TABLE "Product" ADD COLUMN "aliexpressProductId" TEXT,
ADD COLUMN "importSource" TEXT;

-- CreateIndex
CREATE INDEX "Product_aliexpressProductId_idx" ON "Product"("aliexpressProductId");
