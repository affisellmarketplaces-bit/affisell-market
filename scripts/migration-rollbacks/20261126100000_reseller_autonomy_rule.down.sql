-- ROLLBACK of migration 20261126100000_reseller_autonomy_rule — DESTRUCTIVE, manual, founder decision only.
--
-- Preferred rollback is NOT this file (docs/MIGRATION-AUTONOMY.md §7):
--   1. COPILOT_AUTOPILOT unset (or anything but "on")  -> nothing is ever applied automatically;
--   2. revoke every grant (kept for the audit trail):
--        UPDATE "ResellerAutonomyRule" SET "revokedAt" = NOW(), "updatedAt" = NOW() WHERE "revokedAt" IS NULL;
--   3. revert the code if needed. The table is isolated (one FK to "User", nothing points to it): leaving it, unused,
--      harms nothing, and the code treats a missing table as "no automation" anyway.
-- Dropping it loses who granted what, with which limits (the AuditLog rows copilot.autonomy.* remain).
-- It does NOT touch Prisma's migration history: afterwards `migrate status` still lists the migration as applied —
-- re-create the table by re-running its migration.sql by hand if the code is ever shipped again.

DROP TABLE IF EXISTS "ResellerAutonomyRule";
