-- Opaque partner listing ref for supplier-facing surfaces (never store display name).

ALTER TABLE "Store" ADD COLUMN "partnerListingCode" TEXT;

UPDATE "Store"
SET "partnerListingCode" = 'AFS-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10))
WHERE "partnerListingCode" IS NULL;

ALTER TABLE "Store" ALTER COLUMN "partnerListingCode" SET NOT NULL;

CREATE UNIQUE INDEX "Store_partnerListingCode_key" ON "Store"("partnerListingCode");
