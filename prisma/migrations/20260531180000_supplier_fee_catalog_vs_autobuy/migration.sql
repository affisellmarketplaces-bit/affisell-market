-- Supplier fee: separate bps for native catalog vs AE auto-buy
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierFeeBpsCatalog" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supplierFeeBpsAutoBuy" INTEGER;
