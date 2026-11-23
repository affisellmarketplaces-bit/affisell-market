-- ROLLBACK of migration 20261124090000_listing_presence_history — DESTRUCTIVE, manual, founder decision only.
--
-- Preferred rollback is NOT this file: revert the code. The table is isolated (no foreign key from or to the rest of the
-- schema) and the trigger on "AffiliateProduct" only appends to it; it never changes or refuses a listing write.
-- To STOP recording without losing what was recorded, drop only the first trigger (first statement below) and keep the
-- table. To remove everything, run the whole file: it deletes the recorded history for good. It does NOT touch
-- Prisma's migration history: to recreate, run the migration's own SQL by hand (it is idempotent), never a
-- `migrate resolve`. Tested on a throwaway PostgreSQL (CI job « Money-path tests on a real PostgreSQL »).

DROP TRIGGER IF EXISTS "AffiliateProduct_listing_presence_history" ON "AffiliateProduct";

DROP FUNCTION IF EXISTS affisell_record_listing_presence();

DROP TRIGGER IF EXISTS "ListingPresenceEvent_append_only" ON "ListingPresenceEvent";

DROP FUNCTION IF EXISTS affisell_listing_presence_append_only();

DROP TABLE IF EXISTS "ListingPresenceEvent";
