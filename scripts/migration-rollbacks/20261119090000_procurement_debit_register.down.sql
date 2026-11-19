-- ROLLBACK of migration 20261119090000_procurement_debit_register — DESTRUCTIVE, manual, founder decision only.
--
-- Preferred rollback is NOT this file: revert the code. The two tables are isolated (no foreign key from or to the rest
-- of the schema, no change to an existing table), so leaving them in place, unused, harms nothing.
-- Use this file only when the tables must disappear (e.g. on a test or preproduction branch). It deletes every recorded
-- movement and reconciliation. It does NOT touch Prisma's migration history: afterwards Prisma still lists the
-- migration as applied, so to recreate the tables run the migration's own SQL by hand (it is idempotent), never a
-- `migrate resolve`. Tested on a throwaway PostgreSQL (CI job « Money-path tests on a real PostgreSQL »).

DROP TRIGGER IF EXISTS "ProcurementDebitAllocation_within_debit" ON "ProcurementDebitAllocation";

DROP FUNCTION IF EXISTS affisell_procurement_allocation_within_debit();

DROP TABLE IF EXISTS "ProcurementDebitAllocation";

DROP TABLE IF EXISTS "ProcurementDebit";
