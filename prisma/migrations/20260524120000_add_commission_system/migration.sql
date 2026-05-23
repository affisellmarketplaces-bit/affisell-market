-- CreateEnum
CREATE TYPE "OrderPaymentSettlementStatus" AS ENUM ('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'CANCELLED');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeAccountId_key" ON "User"("stripeAccountId");

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripeChargeId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "subtotalCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "totalCents" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "platformCommissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.12;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "platformCommissionCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stripeFeesCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sellerPayoutCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentSettlementStatus" "OrderPaymentSettlementStatus" NOT NULL DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripePaymentIntentId_key" ON "Order"("stripePaymentIntentId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripeInvoiceId_key" ON "Order"("stripeInvoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripeChargeId_key" ON "Order"("stripeChargeId");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripeTransferId_key" ON "Order"("stripeTransferId");

-- CreateTable OrderStripeRefund
CREATE TABLE IF NOT EXISTS "OrderStripeRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stripeRefundId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "commissionReturnedCents" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStripeRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderStripeRefund_stripeRefundId_key" ON "OrderStripeRefund"("stripeRefundId");
CREATE INDEX IF NOT EXISTS "OrderStripeRefund_orderId_idx" ON "OrderStripeRefund"("orderId");

DO $$ BEGIN
  ALTER TABLE "OrderStripeRefund" ADD CONSTRAINT "OrderStripeRefund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
