-- WooCommerce compatibility layer for AutoDS store onboarding (wc-auth + REST API keys)
CREATE TABLE IF NOT EXISTS "WooCommerceApiCredential" (
  "id" TEXT NOT NULL,
  "appName" TEXT NOT NULL,
  "externalUserId" TEXT NOT NULL,
  "consumerKey" TEXT NOT NULL,
  "consumerSecret" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "keyPermissions" TEXT,
  "grantedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "WooCommerceApiCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WooCommerceApiCredential_consumerKey_key" ON "WooCommerceApiCredential"("consumerKey");
CREATE INDEX IF NOT EXISTS "WooCommerceApiCredential_externalUserId_appName_idx" ON "WooCommerceApiCredential"("externalUserId", "appName");
CREATE INDEX IF NOT EXISTS "WooCommerceApiCredential_revokedAt_idx" ON "WooCommerceApiCredential"("revokedAt");
