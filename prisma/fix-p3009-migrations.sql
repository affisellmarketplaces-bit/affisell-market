-- P3009: Prisma blocks deploy while a row in "_prisma_migrations" has started_at set and finished_at NULL.
-- deploy-repair.sql must run first so the DB schema matches applied migrations.
-- This only fixes migration *history* (not schema).

UPDATE "_prisma_migrations"
SET
  finished_at = COALESCE(finished_at, started_at, NOW()),
  applied_steps_count = GREATEST(COALESCE(applied_steps_count, 0), 1),
  logs = NULL
WHERE finished_at IS NULL
  AND rolled_back_at IS NULL;
