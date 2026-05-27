-- Affisell Luxe Atelier — curated luxury listings & collections

CREATE TABLE "LuxuryCollection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "coverImageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LuxuryCollection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LuxuryCollection_slug_key" ON "LuxuryCollection"("slug");
CREATE INDEX "LuxuryCollection_active_sortOrder_idx" ON "LuxuryCollection"("active", "sortOrder");

ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "luxuryTier" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "AffiliateProduct" ADD COLUMN IF NOT EXISTS "luxuryCollectionId" TEXT;

CREATE INDEX IF NOT EXISTS "AffiliateProduct_luxuryTier_isListed_idx" ON "AffiliateProduct"("luxuryTier", "isListed");

ALTER TABLE "AffiliateProduct" ADD CONSTRAINT "AffiliateProduct_luxuryCollectionId_fkey" FOREIGN KEY ("luxuryCollectionId") REFERENCES "LuxuryCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
