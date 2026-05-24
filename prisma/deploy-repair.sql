-- Idempotent schema repair before migrate deploy (Neon drift / failed partial migrations).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeOnboardedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCapabilities" JSONB;

CREATE TABLE IF NOT EXISTS "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProcessedWebhook_orderId_idx" ON "ProcessedWebhook"("orderId");

ALTER TABLE "ProcessedWebhook" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'success';
ALTER TABLE "ProcessedWebhook" ADD COLUMN IF NOT EXISTS "error" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransferRole') THEN
    CREATE TYPE "TransferRole" AS ENUM ('SUPPLIER', 'AFFILIATE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TransferStatus') THEN
    CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SplitStatus') THEN
    CREATE TYPE "SplitStatus" AS ENUM ('PENDING', 'PARTIAL', 'SUCCESS', 'FAILED');
  END IF;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "splitStatus" "SplitStatus" NOT NULL DEFAULT 'PENDING';

CREATE TABLE IF NOT EXISTS "TransferAttempt" (
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

CREATE INDEX IF NOT EXISTS "Order_splitStatus_idx" ON "Order"("splitStatus");
CREATE INDEX IF NOT EXISTS "TransferAttempt_status_attempts_idx" ON "TransferAttempt"("status", "attempts");
CREATE UNIQUE INDEX IF NOT EXISTS "TransferAttempt_orderId_role_key" ON "TransferAttempt"("orderId", "role");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TransferAttempt_orderId_fkey'
  ) THEN
    ALTER TABLE "TransferAttempt"
      ADD CONSTRAINT "TransferAttempt_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
