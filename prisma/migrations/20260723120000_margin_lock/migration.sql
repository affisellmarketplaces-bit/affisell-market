-- CreateTable
CREATE TABLE "MarginLock" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "lockedCost" DOUBLE PRECISION NOT NULL,
    "currentCost" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarginLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarginLock_resellerId_status_idx" ON "MarginLock"("resellerId", "status");

-- CreateIndex
CREATE INDEX "MarginLock_expiresAt_idx" ON "MarginLock"("expiresAt");

-- CreateIndex
CREATE INDEX "MarginLock_productId_idx" ON "MarginLock"("productId");

-- AddForeignKey
ALTER TABLE "MarginLock" ADD CONSTRAINT "MarginLock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginLock" ADD CONSTRAINT "MarginLock_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
