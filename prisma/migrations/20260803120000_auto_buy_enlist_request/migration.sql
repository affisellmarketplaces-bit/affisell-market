-- Auto-buy enlist requests (supplier → admin approval)
CREATE TABLE IF NOT EXISTS "AutoBuyEnlistRequest" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "aeUrl" TEXT NOT NULL,
    "aeProductId" TEXT NOT NULL,
    "nameHint" TEXT,
    "note" TEXT,
    "wholesalePriceCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionReason" TEXT,
    "productId" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoBuyEnlistRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutoBuyEnlistRequest_supplierId_aeProductId_key"
  ON "AutoBuyEnlistRequest"("supplierId", "aeProductId");

CREATE INDEX IF NOT EXISTS "AutoBuyEnlistRequest_status_createdAt_idx"
  ON "AutoBuyEnlistRequest"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "AutoBuyEnlistRequest_supplierId_createdAt_idx"
  ON "AutoBuyEnlistRequest"("supplierId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AutoBuyEnlistRequest"
    ADD CONSTRAINT "AutoBuyEnlistRequest_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AutoBuyEnlistRequest"
    ADD CONSTRAINT "AutoBuyEnlistRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
