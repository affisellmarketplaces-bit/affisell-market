-- AlterTable
ALTER TABLE "User" ADD COLUMN "stripeCapabilities" JSONB;

-- AlterTable
ALTER TABLE "ProcessedWebhook" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'success';
ALTER TABLE "ProcessedWebhook" ADD COLUMN "error" TEXT;
