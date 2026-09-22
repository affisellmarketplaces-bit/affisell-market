-- Admin-granted permission for a supplier to use a sourcing channel's auto-buy (Affisell
-- spends real money on the supplier's behalf on that external site). Idempotent + additive.
CREATE TABLE IF NOT EXISTS "SupplierAutoBuyAuthorization" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "channelType" "SupplierChannelType" NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "SupplierAutoBuyAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierAutoBuyAuthorization_supplierId_channelType_key"
    ON "SupplierAutoBuyAuthorization"("supplierId", "channelType");

CREATE INDEX IF NOT EXISTS "SupplierAutoBuyAuthorization_channelType_revokedAt_idx"
    ON "SupplierAutoBuyAuthorization"("channelType", "revokedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierAutoBuyAuthorization_supplierId_fkey'
  ) THEN
    ALTER TABLE "SupplierAutoBuyAuthorization"
      ADD CONSTRAINT "SupplierAutoBuyAuthorization_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupplierAutoBuyAuthorization_grantedById_fkey'
  ) THEN
    ALTER TABLE "SupplierAutoBuyAuthorization"
      ADD CONSTRAINT "SupplierAutoBuyAuthorization_grantedById_fkey"
      FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Grandfather in suppliers already actively auto-buying from AliExpress before this gate
-- existed — the new permission layer must never silently turn off a live integration.
INSERT INTO "SupplierAutoBuyAuthorization" ("id", "supplierId", "channelType", "grantedAt", "note")
SELECT DISTINCT
    gen_random_uuid()::text,
    p."supplierId",
    'ALIEXPRESS'::"SupplierChannelType",
    CURRENT_TIMESTAMP,
    'Backfilled: already active before the admin-authorization gate (2026-09-22)'
FROM "Product" p
JOIN "SupplierLink" sl ON sl."productId" = p."id"
WHERE sl."autoBuyEnabled" = true
  AND sl."isActive" = true
ON CONFLICT ("supplierId", "channelType") DO NOTHING;
