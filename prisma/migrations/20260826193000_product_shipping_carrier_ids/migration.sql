-- Supplier-configured carriers for PDP « Livraison pro » cards
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingCarrierIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
