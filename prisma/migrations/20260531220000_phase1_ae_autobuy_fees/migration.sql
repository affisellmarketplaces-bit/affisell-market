-- Phase 1: split Affisell fees on Order + per-role bps on User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierFeeBps" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "affiliatePlatformFeeBps" INTEGER;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "supplierFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "affiliateFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "aeWholesaleCents" INTEGER;
