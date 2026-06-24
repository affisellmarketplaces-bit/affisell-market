-- Medusa v2 handle bridge for try-on sync (medusa-backend → Prisma Product)
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "medusaHandle" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_medusaHandle_key" ON "Product"("medusaHandle");
