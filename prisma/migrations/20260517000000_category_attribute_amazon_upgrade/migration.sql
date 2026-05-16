-- CategoryAttribute: Amazon-style validation, dependencies, help copy
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "validationRule" JSONB;
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "dependsOnKey" TEXT;
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "dependsOnValue" TEXT;
ALTER TABLE "CategoryAttribute" ADD COLUMN IF NOT EXISTS "helpText" TEXT;

CREATE INDEX IF NOT EXISTS "CategoryAttribute_dependsOnKey_idx" ON "CategoryAttribute"("dependsOnKey");

-- ProductAttribute value search (trigram GIN for ILIKE / contains on spec values)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "ProductAttribute_value_trgm_idx"
  ON "ProductAttribute" USING GIN ("value" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "ProductAttribute_key_value_idx"
  ON "ProductAttribute"("key", "value");
