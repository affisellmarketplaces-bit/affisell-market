-- Supplier-configurable warehouse ship-from and return receiving addresses
ALTER TABLE "Store" ADD COLUMN "shipFromAddress" JSONB;
ALTER TABLE "Store" ADD COLUMN "returnAddress" JSONB;
