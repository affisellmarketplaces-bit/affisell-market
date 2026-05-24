-- Idempotent schema repair before migrate deploy (Neon drift / partial applies).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeOnboardedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCapabilities" JSONB;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ProcessedWebhook'
  ) THEN
    ALTER TABLE "ProcessedWebhook" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'success';
    ALTER TABLE "ProcessedWebhook" ADD COLUMN IF NOT EXISTS "error" TEXT;
  END IF;
END $$;

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
