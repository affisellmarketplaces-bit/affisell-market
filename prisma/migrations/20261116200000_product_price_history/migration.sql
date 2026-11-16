-- Supplier price history (finalisation master doc F1). Additive and isolated: one new table, two triggers.
--
-- Every change of a supplier price is recorded BY THE DATABASE, whatever wrote it — the supplier form, a CSV import, an
-- integration sync, an AliExpress refresh, an admin script: about fifteen code paths write these columns and none of them
-- has to know about this table. Three price stores are followed:
--   * "Product"."basePriceCents"                         → variantKey NULL (the product's supplier price);
--   * "Product"."variants" -> 'variantRows'[].priceCents  → variantKey 'row:<row name>' (advanced SKU lines);
--   * "ProductVariant" (wholesalePriceCents, else supplierPrice in euros) → variantKey 'pv:<color>/<size>'.
-- A variant price is compared with the LAST RECORDED price of the same key (not with OLD): variant rows are often deleted
-- and recreated by syncs, and a recreated row at the same price is not a change.
-- The triggers only INSERT into the history table; they never change the observed row and never fail the write they
-- observe for a reason of their own (no constraint other than the primary key, no foreign key).

CREATE TABLE IF NOT EXISTS "ProductPriceHistory" (
    "id" BIGSERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "variantKey" TEXT,
    "priceCents" INTEGER NOT NULL,
    "previousCents" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductPriceHistory_productId_recordedAt_idx"
    ON "ProductPriceHistory" ("productId", "recordedAt");

CREATE INDEX IF NOT EXISTS "ProductPriceHistory_productId_variantKey_id_idx"
    ON "ProductPriceHistory" ("productId", "variantKey", "id");

-- Records one variant price when it differs from the last recorded price of that key.
CREATE OR REPLACE FUNCTION affisell_record_variant_price(p_product TEXT, p_supplier TEXT, p_key TEXT, p_price INTEGER)
RETURNS void AS $$
DECLARE
    last_price INTEGER;
BEGIN
    IF p_price IS NULL OR p_price <= 0 OR p_key IS NULL THEN
        RETURN;
    END IF;
    SELECT h."priceCents" INTO last_price
    FROM "ProductPriceHistory" h
    WHERE h."productId" = p_product AND h."variantKey" = p_key
    ORDER BY h."id" DESC
    LIMIT 1;
    IF last_price IS DISTINCT FROM p_price THEN
        INSERT INTO "ProductPriceHistory" ("productId", "supplierId", "variantKey", "priceCents", "previousCents")
        VALUES (p_product, p_supplier, p_key, p_price, last_price);
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION affisell_record_product_price() RETURNS trigger AS $$
DECLARE
    row_item JSONB;
    row_name TEXT;
    row_price NUMERIC;
BEGIN
    IF TG_OP = 'INSERT' OR NEW."basePriceCents" IS DISTINCT FROM OLD."basePriceCents" THEN
        INSERT INTO "ProductPriceHistory" ("productId", "supplierId", "variantKey", "priceCents", "previousCents")
        VALUES (
            NEW."id",
            NEW."supplierId",
            NULL,
            NEW."basePriceCents",
            CASE WHEN TG_OP = 'UPDATE' THEN OLD."basePriceCents" ELSE NULL END
        );
    END IF;

    IF (TG_OP = 'INSERT' OR NEW."variants" IS DISTINCT FROM OLD."variants")
        AND jsonb_typeof(NEW."variants" -> 'variantRows') = 'array' THEN
        FOR row_item IN SELECT * FROM jsonb_array_elements(NEW."variants" -> 'variantRows') LOOP
            IF jsonb_typeof(row_item) = 'object' AND jsonb_typeof(row_item -> 'priceCents') = 'number' THEN
                row_name := btrim(coalesce(row_item ->> 'name', ''));
                row_price := (row_item ->> 'priceCents')::NUMERIC;
                IF row_name <> '' AND row_price > 0 AND row_price < 2147483647 THEN
                    PERFORM affisell_record_variant_price(NEW."id", NEW."supplierId", 'row:' || row_name, round(row_price)::INTEGER);
                END IF;
            END IF;
        END LOOP;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Product_price_history" ON "Product";
CREATE TRIGGER "Product_price_history"
    AFTER INSERT OR UPDATE OF "basePriceCents", "variants" ON "Product"
    FOR EACH ROW EXECUTE FUNCTION affisell_record_product_price();

CREATE OR REPLACE FUNCTION affisell_record_product_variant_price() RETURNS trigger AS $$
DECLARE
    unit_price INTEGER;
    supplier TEXT;
BEGIN
    unit_price := coalesce(NEW."wholesalePriceCents", round(NEW."supplierPrice" * 100)::INTEGER);
    SELECT p."supplierId" INTO supplier FROM "Product" p WHERE p."id" = NEW."productId";
    PERFORM affisell_record_variant_price(
        NEW."productId",
        supplier,
        'pv:' || coalesce(btrim(NEW."color"), '') || '/' || coalesce(btrim(NEW."size"), ''),
        unit_price
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductVariant_price_history" ON "ProductVariant";
CREATE TRIGGER "ProductVariant_price_history"
    AFTER INSERT OR UPDATE OF "wholesalePriceCents", "supplierPrice" ON "ProductVariant"
    FOR EACH ROW EXECUTE FUNCTION affisell_record_product_variant_price();
