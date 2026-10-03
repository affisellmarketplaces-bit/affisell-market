-- Per-product reseller exclusivity. Additive only: nullable columns (no row is touched) + one new table.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "exclusiveAffiliateId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "exclusiveGrantedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "exclusiveUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Product_exclusiveAffiliateId_idx" ON "Product"("exclusiveAffiliateId");

CREATE TABLE IF NOT EXISTS "ProductExclusivityRequest" (
  "id"          TEXT NOT NULL,
  "productId"   TEXT NOT NULL,
  "supplierId"  TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "message"     VARCHAR(500),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "ProductExclusivityRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductExclusivityRequest_productId_status_idx" ON "ProductExclusivityRequest"("productId", "status");
CREATE INDEX IF NOT EXISTS "ProductExclusivityRequest_supplierId_status_idx" ON "ProductExclusivityRequest"("supplierId", "status");
CREATE INDEX IF NOT EXISTS "ProductExclusivityRequest_affiliateId_status_idx" ON "ProductExclusivityRequest"("affiliateId", "status");

-- At most one open request per reseller and product (Prisma cannot express a partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS "ProductExclusivityRequest_open_unique"
  ON "ProductExclusivityRequest"("productId", "affiliateId") WHERE "status" = 'PENDING';
