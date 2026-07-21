-- AlterTable
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "deliverySLA" INTEGER;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "deliveryPriority" TEXT NOT NULL DEFAULT 'balanced';
