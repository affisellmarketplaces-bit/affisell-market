-- CreateEnum
CREATE TYPE "TransferRole" AS ENUM ('SUPPLIER', 'AFFILIATE');
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE "SplitStatus" AS ENUM ('PENDING', 'PARTIAL', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "splitStatus" "SplitStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "TransferAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "role" "TransferRole" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "stripeTransferId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_splitStatus_idx" ON "Order"("splitStatus");
CREATE INDEX "TransferAttempt_status_attempts_idx" ON "TransferAttempt"("status", "attempts");
CREATE UNIQUE INDEX "TransferAttempt_orderId_role_key" ON "TransferAttempt"("orderId", "role");

-- AddForeignKey
ALTER TABLE "TransferAttempt" ADD CONSTRAINT "TransferAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
