-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "vatNumber" TEXT;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxCountry" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4);

-- AlterTable OrderStripeRefund
ALTER TABLE "OrderStripeRefund" ADD COLUMN IF NOT EXISTS "taxReturnedCents" INTEGER NOT NULL DEFAULT 0;
