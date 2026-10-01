-- Admin-toggleable runtime switches (click to flip from /admin/settings/platform-flags, no
-- redeploy). Additive-only: existing env-var kill switches (GROWTH_CATALOG_CAP_PAUSED, etc.)
-- stay as the fallback when no row exists for a given key.
CREATE TABLE IF NOT EXISTS "PlatformFlag" (
  "key"       TEXT NOT NULL,
  "enabled"   BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,

  CONSTRAINT "PlatformFlag_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "PlatformFlag_enabled_idx" ON "PlatformFlag"("enabled");
