-- Proactive profitability alerts for resellers (commercial intelligence). Additive and isolated: three new tables, no
-- change to an existing table, no foreign key (read defensively; a reseller removed later leaves inert rows).
--
--   * "ResellerProfitAlert"      one row per alert. UNIQUE ("affiliateId", "dedupeKey") is the idempotency key: the
--                                detector inserts with ON CONFLICT DO NOTHING, so two concurrent runs create ONE alert.
--                                dedupeKey = '<productId>:<14-day bucket>' (one alert per product per 14 days).
--   * "ResellerAlertDelivery"    one row per alert and channel. UNIQUE ("alertId", "channel") is the claim: only the run
--                                that inserts it delivers; a replay finds it and sends nothing. New channels only add
--                                a value to the CHECK list.
--   * "ResellerAlertPreference"  the reseller's own choices: in-app on by default, e-mail OFF until they switch it on.

CREATE TABLE IF NOT EXISTS "ResellerProfitAlert" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "listingId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "primaryCause" TEXT NOT NULL,
    "causes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "previousNetCents" INTEGER NOT NULL,
    "currentNetCents" INTEGER NOT NULL,
    "netChangeCents" INTEGER NOT NULL,
    "since" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerProfitAlert_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResellerProfitAlert_decline_check" CHECK ("netChangeCents" < 0),
    CONSTRAINT "ResellerProfitAlert_cause_check" CHECK ("primaryCause" ~ '^[a-z_]{1,40}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResellerProfitAlert_affiliateId_dedupeKey_key"
    ON "ResellerProfitAlert" ("affiliateId", "dedupeKey");

CREATE INDEX IF NOT EXISTS "ResellerProfitAlert_affiliateId_createdAt_idx"
    ON "ResellerProfitAlert" ("affiliateId", "createdAt");

CREATE INDEX IF NOT EXISTS "ResellerProfitAlert_affiliateId_productId_createdAt_idx"
    ON "ResellerProfitAlert" ("affiliateId", "productId", "createdAt");

CREATE TABLE IF NOT EXISTS "ResellerAlertDelivery" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerAlertDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResellerAlertDelivery_channel_check" CHECK ("channel" IN ('in_app', 'email')),
    CONSTRAINT "ResellerAlertDelivery_status_check" CHECK ("status" IN ('sending', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResellerAlertDelivery_alertId_channel_key"
    ON "ResellerAlertDelivery" ("alertId", "channel");

CREATE TABLE IF NOT EXISTS "ResellerAlertPreference" (
    "affiliateId" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResellerAlertPreference_pkey" PRIMARY KEY ("affiliateId"),
    CONSTRAINT "ResellerAlertPreference_locale_check" CHECK ("locale" IN ('fr', 'en', 'de', 'es', 'it', 'nl', 'pl', 'zh'))
);
