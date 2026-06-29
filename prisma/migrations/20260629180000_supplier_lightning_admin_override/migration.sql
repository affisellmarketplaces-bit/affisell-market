-- Admin founder override for Lightning Payout trust gate
ALTER TABLE "SupplierProfile" ADD COLUMN IF NOT EXISTS "lightningAdminOverride" BOOLEAN NOT NULL DEFAULT false;
