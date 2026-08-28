-- ProductRequest: country-level provenance + compliance requirements
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "provenanceCountries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "complianceRequirements" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS "ProductRequest_provenanceCountries_idx" ON "ProductRequest" USING GIN ("provenanceCountries");
CREATE INDEX IF NOT EXISTS "ProductRequest_complianceRequirements_idx" ON "ProductRequest" USING GIN ("complianceRequirements");
