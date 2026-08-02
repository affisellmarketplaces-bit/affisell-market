-- Platform OAuth credentials (AliExpress tokens encrypted at rest)
CREATE TABLE IF NOT EXISTS "PlatformOAuthCredential" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3),
    "refreshExpiresAt" TIMESTAMP(3),
    "accountHint" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformOAuthCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformOAuthCredential_provider_key" ON "PlatformOAuthCredential"("provider");
