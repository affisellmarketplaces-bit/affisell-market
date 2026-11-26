-- Reseller selling-price history (commercial intelligence: why a reseller's profitability moved). Additive and
-- isolated: one new table, one trigger on "AffiliateProduct".
--
-- Every real change of a reseller's selling price is recorded BY THE DATABASE, whatever wrote it: the listing editor,
-- the listings API, a listing creation or quick-add, the margin auto-fix, the variant auto-adjust cron, an import, a
-- seed or an admin script. Two price stores are followed:
--   * "AffiliateProduct"."sellingPriceCents"                    -> variantKey NULL (the listing price);
--   * "AffiliateProduct"."variantPricing" -> <key> -> sellingPriceCents -> variantKey 'opt:<key>' (per-variant price;
--     a key that disappears is recorded with priceCents NULL = the override was removed, the listing price applies).
-- A row is written only when the value really changes (IS DISTINCT FROM the previous value of the same row), so a save
-- that leaves the price alone writes nothing and one change is never recorded twice.
--
-- Source / actor: the writer MAY declare them for its transaction with
--   set_config('affisell.listing_price_source', '<source>', true) and set_config('affisell.listing_price_actor', '<id>', true)
-- (lib/listing-price-history/record.server.ts). Undeclared = 'unattributed'. An invalid value is replaced, never
-- rejected: the trigger must never make the observed write fail for a reason of its own (no foreign key, the CHECK
-- constraints only guard what the trigger itself writes).
-- Currency: the platform settles in EUR only (Order.currency default, checkout); the column makes that explicit.

CREATE TABLE IF NOT EXISTS "ListingPriceHistory" (
    "id" BIGSERIAL NOT NULL,
    "affiliateProductId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantKey" TEXT,
    "priceCents" INTEGER,
    "previousCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "source" TEXT NOT NULL DEFAULT 'unattributed',
    "actorId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPriceHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ListingPriceHistory_price_check" CHECK ("priceCents" IS NULL OR "priceCents" >= 0),
    CONSTRAINT "ListingPriceHistory_previous_check" CHECK ("previousCents" IS NULL OR "previousCents" >= 0),
    CONSTRAINT "ListingPriceHistory_change_check" CHECK ("priceCents" IS DISTINCT FROM "previousCents"),
    CONSTRAINT "ListingPriceHistory_base_price_check" CHECK ("variantKey" IS NOT NULL OR "priceCents" IS NOT NULL),
    CONSTRAINT "ListingPriceHistory_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    CONSTRAINT "ListingPriceHistory_source_check" CHECK ("source" ~ '^[a-z0-9_.:-]{1,64}$')
);

CREATE INDEX IF NOT EXISTS "ListingPriceHistory_affiliateId_effectiveAt_idx"
    ON "ListingPriceHistory" ("affiliateId", "effectiveAt");

CREATE INDEX IF NOT EXISTS "ListingPriceHistory_affiliateProductId_variantKey_id_idx"
    ON "ListingPriceHistory" ("affiliateProductId", "variantKey", "id");

CREATE OR REPLACE FUNCTION affisell_record_listing_price() RETURNS trigger AS $$
DECLARE
    v_source TEXT;
    v_actor TEXT;
    v_key TEXT;
    v_new NUMERIC;
    v_old NUMERIC;
    v_new_int INTEGER;
    v_old_int INTEGER;
    v_old_pricing JSONB;
    v_new_pricing JSONB;
BEGIN
    v_source := lower(btrim(coalesce(current_setting('affisell.listing_price_source', true), '')));
    IF v_source !~ '^[a-z0-9_.:-]{1,64}$' THEN
        v_source := 'unattributed';
    END IF;
    v_actor := btrim(coalesce(current_setting('affisell.listing_price_actor', true), ''));
    IF v_actor !~ '^[A-Za-z0-9_:-]{1,64}$' THEN
        v_actor := NULL;
    END IF;

    -- Listing price.
    IF NEW."sellingPriceCents" IS NOT NULL AND NEW."sellingPriceCents" >= 0
        AND (TG_OP = 'INSERT' OR NEW."sellingPriceCents" IS DISTINCT FROM OLD."sellingPriceCents") THEN
        INSERT INTO "ListingPriceHistory"
            ("affiliateProductId", "affiliateId", "productId", "variantKey", "priceCents", "previousCents", "source", "actorId")
        VALUES (
            NEW."id", NEW."affiliateId", NEW."productId", NULL, NEW."sellingPriceCents",
            CASE WHEN TG_OP = 'UPDATE' AND OLD."sellingPriceCents" >= 0 THEN OLD."sellingPriceCents" ELSE NULL END,
            v_source, v_actor
        );
    END IF;

    -- Per-variant prices (variantPricing JSON object: { "<key>": { "sellingPriceCents": n, ... } }).
    v_new_pricing := CASE WHEN jsonb_typeof(NEW."variantPricing") = 'object' THEN NEW."variantPricing" ELSE '{}'::jsonb END;
    IF TG_OP = 'UPDATE' THEN
        IF NEW."variantPricing" IS NOT DISTINCT FROM OLD."variantPricing" THEN
            RETURN NULL;
        END IF;
        v_old_pricing := CASE WHEN jsonb_typeof(OLD."variantPricing") = 'object' THEN OLD."variantPricing" ELSE '{}'::jsonb END;
    ELSE
        v_old_pricing := '{}'::jsonb;
    END IF;

    FOR v_key IN
        SELECT k FROM jsonb_object_keys(v_new_pricing) AS k
        UNION
        SELECT k FROM jsonb_object_keys(v_old_pricing) AS k
    LOOP
        v_new := CASE WHEN jsonb_typeof(v_new_pricing -> v_key -> 'sellingPriceCents') = 'number'
                      THEN (v_new_pricing -> v_key ->> 'sellingPriceCents')::NUMERIC END;
        v_old := CASE WHEN jsonb_typeof(v_old_pricing -> v_key -> 'sellingPriceCents') = 'number'
                      THEN (v_old_pricing -> v_key ->> 'sellingPriceCents')::NUMERIC END;
        v_new_int := CASE WHEN v_new >= 0 AND v_new < 2147483647 THEN round(v_new)::INTEGER END;
        v_old_int := CASE WHEN v_old >= 0 AND v_old < 2147483647 THEN round(v_old)::INTEGER END;
        IF v_new_int IS DISTINCT FROM v_old_int AND length(v_key) BETWEEN 1 AND 200 THEN
            INSERT INTO "ListingPriceHistory"
                ("affiliateProductId", "affiliateId", "productId", "variantKey", "priceCents", "previousCents", "source", "actorId")
            VALUES (NEW."id", NEW."affiliateId", NEW."productId", 'opt:' || v_key, v_new_int, v_old_int, v_source, v_actor);
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AffiliateProduct_listing_price_history" ON "AffiliateProduct";
CREATE TRIGGER "AffiliateProduct_listing_price_history"
    AFTER INSERT OR UPDATE OF "sellingPriceCents", "variantPricing" ON "AffiliateProduct"
    FOR EACH ROW EXECUTE FUNCTION affisell_record_listing_price();
