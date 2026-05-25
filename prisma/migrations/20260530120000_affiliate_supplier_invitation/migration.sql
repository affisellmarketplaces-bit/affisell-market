-- CreateTable
CREATE TABLE "AffiliateSupplierInvitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "personalMessage" TEXT NOT NULL DEFAULT '',
    "offeredCommissionPct" DOUBLE PRECISION,
    "categoryHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "registeredAt" TIMESTAMP(3),
    "firstProductId" TEXT,
    "catalogLiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateSupplierInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSupplierInvitation_token_key" ON "AffiliateSupplierInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateSupplierInvitation_supplierId_key" ON "AffiliateSupplierInvitation"("supplierId");

-- CreateIndex
CREATE INDEX "AffiliateSupplierInvitation_affiliateId_createdAt_idx" ON "AffiliateSupplierInvitation"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateSupplierInvitation_status_idx" ON "AffiliateSupplierInvitation"("status");

-- AddForeignKey
ALTER TABLE "AffiliateSupplierInvitation" ADD CONSTRAINT "AffiliateSupplierInvitation_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateSupplierInvitation" ADD CONSTRAINT "AffiliateSupplierInvitation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
