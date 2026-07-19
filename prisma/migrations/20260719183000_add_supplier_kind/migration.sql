-- Affisell Radar supplier sub-type (additive, non-breaking)
-- Values: unset | producer | stocker
-- Existing SUPPLIER rows stay "unset" via DEFAULT — no backfill required.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierKind" TEXT NOT NULL DEFAULT 'unset';
