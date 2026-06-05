-- Escrow allocation per marketplace order (auto-buy upstream COGS + supplier margin snapshot).

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "upstreamCogsCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "supplierMarginCents" INTEGER;
