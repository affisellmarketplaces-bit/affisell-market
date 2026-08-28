-- Reseller-chosen sourcing origin on product requests (idempotent deploy).
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "sourceProvenance" TEXT NOT NULL DEFAULT 'any';

CREATE INDEX IF NOT EXISTS "ProductRequest_sourceProvenance_idx" ON "ProductRequest"("sourceProvenance");
