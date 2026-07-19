-- StandardProduct: GMC-ready fields + unique includes country+day
-- Schema: market_intelli

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "country" TEXT;

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "brand" TEXT;

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "link" TEXT;

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "availability" TEXT;

ALTER TABLE "market_intelli"."StandardProduct"
  ADD COLUMN IF NOT EXISTS "condition" TEXT;

UPDATE "market_intelli"."StandardProduct"
SET "country" = COALESCE(NULLIF(TRIM("region"), ''), 'US')
WHERE "country" IS NULL OR TRIM("country") = '';

UPDATE "market_intelli"."StandardProduct"
SET "availability" = 'in_stock'
WHERE "availability" IS NULL OR TRIM("availability") = '';

UPDATE "market_intelli"."StandardProduct"
SET "condition" = 'new'
WHERE "condition" IS NULL OR TRIM("condition") = '';

-- day → DATE
ALTER TABLE "market_intelli"."StandardProduct"
  ALTER COLUMN "day" TYPE DATE
  USING (("day" AT TIME ZONE 'UTC')::date);

ALTER TABLE "market_intelli"."StandardProduct"
  ALTER COLUMN "country" SET DEFAULT 'US';

ALTER TABLE "market_intelli"."StandardProduct"
  ALTER COLUMN "country" SET NOT NULL;

ALTER TABLE "market_intelli"."StandardProduct"
  ALTER COLUMN "availability" SET DEFAULT 'in_stock';

ALTER TABLE "market_intelli"."StandardProduct"
  ALTER COLUMN "condition" SET DEFAULT 'new';

ALTER TABLE "market_intelli"."StandardProduct"
  DROP CONSTRAINT IF EXISTS "StandardProduct_connectorId_externalId_day_key";

-- Deduplicate before new unique
DELETE FROM "market_intelli"."StandardProduct" AS a
  USING "market_intelli"."StandardProduct" AS b
WHERE a."connectorId" = b."connectorId"
  AND a."externalId" = b."externalId"
  AND a."country" = b."country"
  AND a."day" = b."day"
  AND a."updatedAt" < b."updatedAt";

CREATE UNIQUE INDEX IF NOT EXISTS "StandardProduct_connectorId_externalId_country_day_key"
  ON "market_intelli"."StandardProduct" ("connectorId", "externalId", "country", "day");

CREATE INDEX IF NOT EXISTS "StandardProduct_country_day_idx"
  ON "market_intelli"."StandardProduct" ("country", "day");
