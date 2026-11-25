-- ROLLBACK of migration 20261125090000_payout_leg_registry — DESTRUCTIVE, manual, founder decision only.
--
-- Preferred rollback is NOT this file: revert the code. The table is isolated (no foreign key from or to the rest of the
-- schema, no change to an existing table), so leaving it in place, unused, harms nothing.
-- Dropping it loses the ONLY record of in-doubt legs and of which idempotency generation each leg reached: before running
-- it, list `SELECT "legKey", "state", "inDoubtReason" FROM "PayoutLeg" WHERE "state" IN ('IN_DOUBT', 'PROCESSING')` and
-- settle every one of them with Stripe by hand. It does NOT touch Prisma's migration history.
-- Tested on a throwaway PostgreSQL (lib/__tests__/payout-leg-registry-db.test.ts).

DROP TRIGGER IF EXISTS "PayoutLeg_no_truncate" ON "PayoutLeg";
DROP TRIGGER IF EXISTS "PayoutLeg_guard" ON "PayoutLeg";
DROP FUNCTION IF EXISTS "affisell_payout_leg_no_truncate"();
DROP FUNCTION IF EXISTS "affisell_payout_leg_guard"();
DROP TABLE IF EXISTS "PayoutLeg";
