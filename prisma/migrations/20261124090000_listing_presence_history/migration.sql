-- Listing presence history: the life of a product in a reseller's shop (founder brief 2026-11-23). Additive and
-- isolated: one new table, two triggers (one on "AffiliateProduct", one guarding the new table).
--
-- Every real change of a listing's PRESENCE is recorded BY THE DATABASE, in the same transaction as the change, whatever
-- wrote it (listing editor, bulk actions, quick add, replacement, admin review, exclusivity, supplier withdrawal,
-- imports, crons, seeds, scripts, raw SQL):
--   * INSERT of a listing      -> kind 'created'  (newListed = the row's isListed, previousListed NULL);
--   * UPDATE of "isListed"     -> kind 'listed' / 'unlisted', ONLY when the value really changes (a double click, a
--                                 retried request or a save that leaves it alone writes nothing);
--   * DELETE of a listing      -> kind 'deleted'  (previousListed = what it was, newListed NULL).
-- Atomicity comes from the trigger itself: a failed or rolled-back transaction leaves no event, a committed change
-- always has its event. Concurrent writers are serialised by the row lock of the UPDATE / DELETE, so the events of a
-- listing follow the real order of its changes (ordered by "id"; "effectiveAt" = clock_timestamp() of the write).
--
-- No date is ever invented: listings that exist when this migration is applied get NO backfilled event. Their state
-- before the first event is read from that event's previousListed (or from the row when no event exists) and their
-- start is reported as UNKNOWN (lower bound = the row's createdAt). The moment history starts is this migration's
-- finished_at in _prisma_migrations (lib/listing-presence).
--
-- Source / actor: the writer MAY declare them for its transaction with
--   set_config('affisell.listing_presence_source', '<source>', true) / set_config('affisell.listing_presence_actor', '<id>', true)
-- (lib/listing-presence/record.server.ts). When absent, the price-history declaration of the same transaction is used
-- (the listing editor already declares 'reseller_ui'), else 'unattributed'. An invalid value is replaced, never
-- rejected: the trigger must never make the observed write fail for a reason of its own (no foreign key; the CHECK
-- constraints only guard what the trigger writes).
--
-- The table is APPEND-ONLY: UPDATE is always refused, DELETE only inside a transaction that declared
-- set_config('affisell.listing_presence_purge', 'on', true) (retention purge, lib/listing-presence — not scheduled).
-- Minimal data: identifiers, two booleans, a kind, a source code, an optional actor id, a timestamp. No buyer data, no
-- free text.

CREATE TABLE IF NOT EXISTS "ListingPresenceEvent" (
    "id" BIGSERIAL NOT NULL,
    "affiliateProductId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "previousListed" BOOLEAN,
    "newListed" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'unattributed',
    "actorId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPresenceEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ListingPresenceEvent_kind_check" CHECK ("kind" IN ('created', 'listed', 'unlisted', 'deleted')),
    CONSTRAINT "ListingPresenceEvent_shape_check" CHECK (
        ("kind" = 'created'  AND "previousListed" IS NULL AND "newListed" IS NOT NULL) OR
        ("kind" = 'listed'   AND "previousListed" = false AND "newListed" = true) OR
        ("kind" = 'unlisted' AND "previousListed" = true  AND "newListed" = false) OR
        ("kind" = 'deleted'  AND "previousListed" IS NOT NULL AND "newListed" IS NULL)
    ),
    CONSTRAINT "ListingPresenceEvent_source_check" CHECK ("source" ~ '^[a-z0-9_.:-]{1,64}$'),
    CONSTRAINT "ListingPresenceEvent_actor_check" CHECK ("actorId" IS NULL OR "actorId" ~ '^[A-Za-z0-9_:-]{1,64}$')
);

CREATE INDEX IF NOT EXISTS "ListingPresenceEvent_affiliateProductId_id_idx"
    ON "ListingPresenceEvent" ("affiliateProductId", "id");

CREATE INDEX IF NOT EXISTS "ListingPresenceEvent_productId_effectiveAt_idx"
    ON "ListingPresenceEvent" ("productId", "effectiveAt");

CREATE INDEX IF NOT EXISTS "ListingPresenceEvent_affiliateId_effectiveAt_idx"
    ON "ListingPresenceEvent" ("affiliateId", "effectiveAt");

CREATE OR REPLACE FUNCTION affisell_record_listing_presence() RETURNS trigger AS $$
DECLARE
    v_source TEXT;
    v_actor TEXT;
BEGIN
    v_source := lower(btrim(coalesce(
        nullif(current_setting('affisell.listing_presence_source', true), ''),
        nullif(current_setting('affisell.listing_price_source', true), ''),
        '')));
    IF v_source !~ '^[a-z0-9_.:-]{1,64}$' THEN
        v_source := 'unattributed';
    END IF;
    v_actor := btrim(coalesce(
        nullif(current_setting('affisell.listing_presence_actor', true), ''),
        nullif(current_setting('affisell.listing_price_actor', true), ''),
        ''));
    IF v_actor !~ '^[A-Za-z0-9_:-]{1,64}$' THEN
        v_actor := NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO "ListingPresenceEvent"
            ("affiliateProductId", "affiliateId", "productId", "kind", "previousListed", "newListed", "source", "actorId", "effectiveAt")
        VALUES (NEW."id", NEW."affiliateId", NEW."productId", 'created', NULL, coalesce(NEW."isListed", false), v_source, v_actor, clock_timestamp());
    ELSIF TG_OP = 'UPDATE' THEN
        IF coalesce(NEW."isListed", false) IS DISTINCT FROM coalesce(OLD."isListed", false) THEN
            INSERT INTO "ListingPresenceEvent"
                ("affiliateProductId", "affiliateId", "productId", "kind", "previousListed", "newListed", "source", "actorId", "effectiveAt")
            VALUES (
                NEW."id", NEW."affiliateId", NEW."productId",
                CASE WHEN coalesce(NEW."isListed", false) THEN 'listed' ELSE 'unlisted' END,
                coalesce(OLD."isListed", false), coalesce(NEW."isListed", false), v_source, v_actor, clock_timestamp()
            );
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO "ListingPresenceEvent"
            ("affiliateProductId", "affiliateId", "productId", "kind", "previousListed", "newListed", "source", "actorId", "effectiveAt")
        VALUES (OLD."id", OLD."affiliateId", OLD."productId", 'deleted', coalesce(OLD."isListed", false), NULL, v_source, v_actor, clock_timestamp());
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "AffiliateProduct_listing_presence_history" ON "AffiliateProduct";
CREATE TRIGGER "AffiliateProduct_listing_presence_history"
    AFTER INSERT OR UPDATE OF "isListed" OR DELETE ON "AffiliateProduct"
    FOR EACH ROW EXECUTE FUNCTION affisell_record_listing_presence();

CREATE OR REPLACE FUNCTION affisell_listing_presence_append_only() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' AND coalesce(current_setting('affisell.listing_presence_purge', true), '') = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'ListingPresenceEvent is append-only (%)', TG_OP USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ListingPresenceEvent_append_only" ON "ListingPresenceEvent";
CREATE TRIGGER "ListingPresenceEvent_append_only"
    BEFORE UPDATE OR DELETE ON "ListingPresenceEvent"
    FOR EACH ROW EXECUTE FUNCTION affisell_listing_presence_append_only();
