-- Align ProcessedWebhook.status with schema (column added in 20260528140000 with a default).
ALTER TABLE "ProcessedWebhook" ALTER COLUMN "status" DROP DEFAULT;
