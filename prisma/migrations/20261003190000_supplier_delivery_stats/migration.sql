-- Measured supplier delivery performance (carrier-attested). Additive only: new table, nothing else touched.
CREATE TABLE IF NOT EXISTS "SupplierDeliveryStats" (
  "supplierId"         TEXT NOT NULL,
  "sampleSize"         INTEGER NOT NULL DEFAULT 0,
  "medianDispatchDays" DOUBLE PRECISION,
  "medianEndToEndDays" DOUBLE PRECISION,
  "p90EndToEndDays"    DOUBLE PRECISION,
  "windowDays"         INTEGER NOT NULL DEFAULT 180,
  "computedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierDeliveryStats_pkey" PRIMARY KEY ("supplierId")
);

CREATE INDEX IF NOT EXISTS "SupplierDeliveryStats_computedAt_idx" ON "SupplierDeliveryStats"("computedAt");
