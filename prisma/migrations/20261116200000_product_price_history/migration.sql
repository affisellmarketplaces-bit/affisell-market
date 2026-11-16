-- Supplier price history (finalisation master doc F1). Additive and isolated: one new table, one trigger on "Product".
--
-- Every change of "Product"."basePriceCents" (the supplier's price) is recorded BY THE DATABASE, whatever wrote it — the
-- supplier form, a CSV import, an integration sync, an AliExpress refresh, an admin script: about fifteen code paths write
-- that column and none of them has to know about this table. A product's creation records its first price.
-- The trigger only INSERTS into the history table; it never changes the "Product" row and never fails the write it observes
-- for a reason of its own (no constraint other than the primary key, no foreign key).

CREATE TABLE IF NOT EXISTS "ProductPriceHistory" (
    "id" BIGSERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "priceCents" INTEGER NOT NULL,
    "previousCents" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPriceHistory_productId_recordedAt_idx"
    ON "ProductPriceHistory" ("productId", "recordedAt");

CREATE OR REPLACE FUNCTION affisell_record_product_price() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW."basePriceCents" IS DISTINCT FROM OLD."basePriceCents" THEN
        INSERT INTO "ProductPriceHistory" ("productId", "supplierId", "priceCents", "previousCents")
        VALUES (
            NEW."id",
            NEW."supplierId",
            NEW."basePriceCents",
            CASE WHEN TG_OP = 'UPDATE' THEN OLD."basePriceCents" ELSE NULL END
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Product_price_history" ON "Product";
CREATE TRIGGER "Product_price_history"
    AFTER INSERT OR UPDATE OF "basePriceCents" ON "Product"
    FOR EACH ROW EXECUTE FUNCTION affisell_record_product_price();
