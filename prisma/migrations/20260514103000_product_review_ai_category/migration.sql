-- CreateTable
CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "suggestedCategory" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");

-- CreateIndex
CREATE INDEX "ProductReview_createdAt_idx" ON "ProductReview"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductReview" ADD CONSTRAINT "ProductReview_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
