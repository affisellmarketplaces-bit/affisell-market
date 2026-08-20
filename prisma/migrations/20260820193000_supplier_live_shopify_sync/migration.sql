-- Supplier live sync: OAuth tokens, external product mirror, webhook idempotency

CREATE TYPE "IntegrationProvider" AS ENUM ('SHOPIFY', 'WOOCOMMERCE', 'CUSTOM_API');
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING');
CREATE TYPE "SyncStatus" AS ENUM ('MANUAL', 'SYNCED', 'STALE', 'ERROR', 'UNPUBLISHED_OOS');

ALTER TABLE "SupplierProfile" ADD COLUMN IF NOT EXISTS "hasLiveSync" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "provider" "IntegrationProvider";
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "shopDomain" TEXT;
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "accessTokenEncrypted" TEXT;
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "refreshTokenEncrypted" TEXT;
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "scopes" TEXT;
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED';
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "webhookId" TEXT;
ALTER TABLE "SupplierIntegration" ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierIntegration_userId_provider_shopDomain_key"
  ON "SupplierIntegration"("userId", "provider", "shopDomain");
CREATE INDEX IF NOT EXISTS "SupplierIntegration_shopDomain_idx" ON "SupplierIntegration"("shopDomain");

CREATE TABLE IF NOT EXISTS "SupplierWebhookEvent" (
  "id" TEXT NOT NULL,
  "shopifyWebhookId" TEXT NOT NULL,
  "topic" TEXT,
  "shopDomain" TEXT,
  "integrationId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierWebhookEvent_shopifyWebhookId_key"
  ON "SupplierWebhookEvent"("shopifyWebhookId");
CREATE INDEX IF NOT EXISTS "SupplierWebhookEvent_shopDomain_idx" ON "SupplierWebhookEvent"("shopDomain");
CREATE INDEX IF NOT EXISTS "SupplierWebhookEvent_integrationId_idx" ON "SupplierWebhookEvent"("integrationId");
CREATE INDEX IF NOT EXISTS "SupplierWebhookEvent_createdAt_idx" ON "SupplierWebhookEvent"("createdAt");

ALTER TABLE "SupplierWebhookEvent"
  ADD CONSTRAINT "SupplierWebhookEvent_integrationId_fkey"
  FOREIGN KEY ("integrationId") REFERENCES "SupplierIntegration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "externalProvider" "IntegrationProvider";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastExternalSyncAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "syncStatus" "SyncStatus" DEFAULT 'MANUAL';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "externalRaw" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "externalContentHash" TEXT;

CREATE INDEX IF NOT EXISTS "Product_supplierId_externalProvider_externalId_idx"
  ON "Product"("supplierId", "externalProvider", "externalId");
