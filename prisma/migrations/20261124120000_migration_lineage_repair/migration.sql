-- LINEAGE REPAIR (2026-11-24): objects the Prisma schema declares but that no migration ever created — see
-- docs/MIGRATION-LINEAGE.md. Guarded statements only: on a database where they already exist nothing changes.

-- Declared by @@index([billingMode, status]) on SponsorCampaign; 20260801210000 added the column, never the index.
CREATE INDEX IF NOT EXISTS "SponsorCampaign_billingMode_status_idx" ON "SponsorCampaign"("billingMode", "status");

-- Short-lived buffer of the admin AliExpress capture bookmarklet (lib/fulfillment/ae-capture-session.ts).
-- No foreign key in the Prisma schema.
CREATE TABLE IF NOT EXISTS "AdminAeCaptureSession" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "result" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminAeCaptureSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAeCaptureSession_productId_expiresAt_idx" ON "AdminAeCaptureSession"("productId", "expiresAt");
