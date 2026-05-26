-- CreateTable
CREATE TABLE "AffiliateSwipe" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateSwipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AffiliateSwipe_affiliateId_action_idx" ON "AffiliateSwipe"("affiliateId", "action");

-- CreateIndex
CREATE INDEX "AffiliateSwipe_affiliateId_createdAt_idx" ON "AffiliateSwipe"("affiliateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSwipe_affiliateId_productId_key" ON "AffiliateSwipe"("affiliateId", "productId");

-- AddForeignKey
ALTER TABLE "AffiliateSwipe" ADD CONSTRAINT "AffiliateSwipe_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateSwipe" ADD CONSTRAINT "AffiliateSwipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
