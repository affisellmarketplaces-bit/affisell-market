-- Step 2: application fields + default status for new candidatures

ALTER TABLE "SourcingAgent" ADD COLUMN IF NOT EXISTS "applicationNote" TEXT;
ALTER TABLE "SourcingAgent" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

ALTER TABLE "SourcingAgent" ALTER COLUMN "status" SET DEFAULT 'PENDING';
