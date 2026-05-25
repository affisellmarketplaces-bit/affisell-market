-- CreateTable
CREATE TABLE "SupplierAffiliateInvitation" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "personalMessage" TEXT NOT NULL DEFAULT '',
    "offeredCommissionPct" DOUBLE PRECISION,
    "categoryHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "affiliateId" TEXT,
    "registeredAt" TIMESTAMP(3),
    "firstListingId" TEXT,
    "listingLiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierAffiliateInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierAffiliateInvitation_token_key" ON "SupplierAffiliateInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierAffiliateInvitation_affiliateId_key" ON "SupplierAffiliateInvitation"("affiliateId");

-- CreateIndex
CREATE INDEX "SupplierAffiliateInvitation_supplierId_createdAt_idx" ON "SupplierAffiliateInvitation"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierAffiliateInvitation_status_idx" ON "SupplierAffiliateInvitation"("status");

-- AddForeignKey
ALTER TABLE "SupplierAffiliateInvitation" ADD CONSTRAINT "SupplierAffiliateInvitation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierAffiliateInvitation" ADD CONSTRAINT "SupplierAffiliateInvitation_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
