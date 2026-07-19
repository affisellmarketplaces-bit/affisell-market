-- RadarGlobalSnapshot: daily history for WINNER_RISING / PRICE_WAR
-- Schema: market_intelli
-- Apply: npm run radar:db:push  OR  psql $RADAR_DATABASE_URL -f this file

ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  ADD COLUMN IF NOT EXISTS "day" TIMESTAMP(3);

-- Backfill day from crawledAt (UTC calendar day)
UPDATE "market_intelli"."RadarGlobalSnapshot"
SET "day" = date_trunc('day', ("crawledAt" AT TIME ZONE 'UTC')) AT TIME ZONE 'UTC'
WHERE "day" IS NULL;

-- Drop legacy uniqueness (one row forever per product)
ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  DROP CONSTRAINT IF EXISTS "RadarGlobalSnapshot_marketplaceId_externalId_country_key";

-- Keep latest crawl per (marketplace, externalId, country, day)
DELETE FROM "market_intelli"."RadarGlobalSnapshot" AS a
  USING "market_intelli"."RadarGlobalSnapshot" AS b
WHERE a."marketplaceId" = b."marketplaceId"
  AND a."externalId" = b."externalId"
  AND a."country" = b."country"
  AND a."day" = b."day"
  AND a."crawledAt" < b."crawledAt";

ALTER TABLE "market_intelli"."RadarGlobalSnapshot"
  ALTER COLUMN "day" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "RadarGlobalSnapshot_marketplaceId_externalId_country_day_key"
  ON "market_intelli"."RadarGlobalSnapshot" ("marketplaceId", "externalId", "country", "day");

CREATE INDEX IF NOT EXISTS "RadarGlobalSnapshot_marketplaceId_externalId_country_day_idx"
  ON "market_intelli"."RadarGlobalSnapshot" ("marketplaceId", "externalId", "country", "day");
