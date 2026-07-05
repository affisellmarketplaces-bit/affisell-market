-- Phase 1: persist transfer reversals + REFUND_PENDING_CLAWBACK settlement state.

CREATE TYPE "TransferReversalStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

ALTER TYPE "OrderPaymentSettlementStatus" ADD VALUE 'REFUND_PENDING_CLAWBACK';

CREATE TABLE "TransferReversal" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stripeRefundId" TEXT NOT NULL,
    "stripeTransferId" TEXT NOT NULL,
    "stripeReversalId" TEXT,
    "role" TEXT NOT NULL,
    "requestedCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "status" "TransferReversalStatus" NOT NULL,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferReversal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TransferReversal_idempotencyKey_key" ON "TransferReversal"("idempotencyKey");
CREATE INDEX "TransferReversal_orderId_idx" ON "TransferReversal"("orderId");
CREATE INDEX "TransferReversal_stripeRefundId_idx" ON "TransferReversal"("stripeRefundId");
CREATE INDEX "TransferReversal_stripeTransferId_idx" ON "TransferReversal"("stripeTransferId");
CREATE INDEX "TransferReversal_orderId_status_idx" ON "TransferReversal"("orderId", "status");

ALTER TABLE "TransferReversal" ADD CONSTRAINT "TransferReversal_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
