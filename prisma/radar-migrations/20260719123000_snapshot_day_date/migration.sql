-- Harden RadarGlobalSnapshot.day to DATE + history indexes
-- Schema: market_intelli

-- Ensure day exists (noop if prior migration applied)
ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  ADD COLUMN IF NOT EXISTS "day" TIMESTAMP(3);

UPDATE "market_intelli"."RadarGlobalSnapshot"
SET "day" = date_trunc('day', ("crawledAt" AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC'
WHERE "day" IS NULL;

ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  DROP CONSTRAINT IF EXISTS "RadarGlobalSnapshot_marketplaceId_externalId_country_key";

-- Deduplicate same calendar day before DATE cast
DELETE FROM "market_intelli"."RadarGlobalSnapshot" AS a
  USING "market_intelli"."RadarGlobalSnapshot" AS b
WHERE a."marketplaceId" = b."marketplaceId"
  AND a."externalId" = b."externalId"
  AND a."country" = b."country"
  AND date_trunc('day', (a."day" AT TIME ZONE 'UTC')) = date_trunc('day', (b."day" AT TIME ZONE 'UTC'))
  AND a."crawledAt" < b."crawledAt";

ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  ALTER COLUMN "day" TYPE DATE
  USING (("day" AT TIME ZONE 'UTC')::date);

ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  ALTER COLUMN "day" SET DEFAULT CURRENT_DATE;

ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  ALTER COLUMN "day" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "RadarGlobalSnapshot_marketplaceId_externalId_country_day_key"
  ON "market_intelli"."RadarGlobalSnapshot" ("marketplaceId", "externalId", "country", "day");

CREATE INDEX IF NOT EXISTS "RadarGlobalSnapshot_day_idx"
  ON "market_intelli"."RadarGlobalSnapshot" ("day");

CREATE INDEX IF NOT EXISTS "RadarGlobalSnapshot_externalId_day_idx"
  ON "market_intelli"."RadarGlobalSnapshot" ("externalId", "day");

CREATE INDEX IF NOT EXISTS "RadarGlobalSnapshot_marketplaceId_externalId_country_day_idx"
  ON "market_intelli"."RadarGlobalSnapshot" ("marketplaceId", "externalId", "country", "day");
