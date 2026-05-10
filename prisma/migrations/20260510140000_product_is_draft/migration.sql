-- AlterTable
ALTER TABLE "Product" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_supplierId_isDraft_idx" ON "Product"("supplierId", "isDraft");
