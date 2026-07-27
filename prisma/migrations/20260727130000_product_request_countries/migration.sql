-- Multi-country product requests (reseller can target several markets)
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "countries" TEXT[] NOT NULL DEFAULT ARRAY['FR']::TEXT[];

UPDATE "ProductRequest"
SET "countries" = ARRAY["country"]
WHERE "country" IS NOT NULL
  AND (
    "countries" IS NULL
    OR cardinality("countries") = 0
    OR ("countries" = ARRAY['FR']::TEXT[] AND "country" <> 'FR')
  );
