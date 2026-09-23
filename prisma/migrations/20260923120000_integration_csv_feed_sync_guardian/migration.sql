-- CSV / Google Sheet feed as a 4th supplier integration provider (no OAuth, no API keys),
-- and a "NEEDS_REVIEW" sync job status for the Sync Guardian anomaly guard: a sync whose
-- fetched-product count crashed vs. the last healthy run is parked here instead of being
-- auto-applied, so a broken feed link can never silently wipe a supplier's live catalog.
-- Step 1: extend enums (must commit before using new values as default).

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'CSV_FEED';
ALTER TYPE "SyncJobStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';
