-- Supplier-authored deliver-to ISO-2 codes (empty = legacy heuristic).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deliveryCountryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
