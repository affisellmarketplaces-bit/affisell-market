-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isLuxury" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_isLuxury_idx" ON "Product"("isLuxury");
