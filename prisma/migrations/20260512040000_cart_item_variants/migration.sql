-- Cart line variants (color / size) + composite unique so the same listing can appear twice with different picks.
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "variantSignature" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "selectedColor" TEXT;
ALTER TABLE "CartItem" ADD COLUMN IF NOT EXISTS "selectedSize" TEXT;

ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_cartId_affiliateProductId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "CartItem_cartId_affiliateProductId_variantSignature_key" ON "CartItem"("cartId", "affiliateProductId", "variantSignature");

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "variantLabel" TEXT;
