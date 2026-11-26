-- READ-ONLY catalog check for migration 20261126100000_reseller_autonomy_rule (docs/MIGRATION-AUTONOMY.md §4).
-- Run with psql in a read-only session:  PGOPTIONS='-c default_transaction_read_only=on' psql "$URL" -f <this file>
-- Every line of the result must say `ok`.

SELECT 'table' AS check, CASE WHEN to_regclass('"ResellerAutonomyRule"') IS NOT NULL THEN 'ok' ELSE 'MISSING' END AS result
UNION ALL
SELECT 'columns', CASE WHEN count(*) = 10 THEN 'ok' ELSE 'got ' || count(*) END
FROM information_schema.columns
WHERE table_name = 'ResellerAutonomyRule'
  AND column_name IN ('id', 'affiliateId', 'actionType', 'maxPriceIncreaseBps', 'maxRunsPerWeek', 'grantedAt',
                      'revokedAt', 'autoRunsWindowStart', 'autoRunsInWindow', 'updatedAt')
UNION ALL
SELECT 'check constraints', CASE WHEN count(*) = 4 THEN 'ok' ELSE 'got ' || count(*) END
FROM pg_constraint
WHERE conrelid = to_regclass('"ResellerAutonomyRule"') AND contype = 'c'
  AND conname IN ('ResellerAutonomyRule_actionType_check', 'ResellerAutonomyRule_maxPriceIncreaseBps_check',
                  'ResellerAutonomyRule_maxRunsPerWeek_check', 'ResellerAutonomyRule_autoRunsInWindow_check')
UNION ALL
SELECT 'unique (affiliateId, actionType)', CASE WHEN count(*) = 1 THEN 'ok' ELSE 'MISSING' END
FROM pg_indexes WHERE indexname = 'ResellerAutonomyRule_affiliateId_actionType_key'
UNION ALL
SELECT 'foreign key to User', CASE WHEN count(*) = 1 THEN 'ok' ELSE 'MISSING' END
FROM pg_constraint WHERE conname = 'ResellerAutonomyRule_affiliateId_fkey'
UNION ALL
SELECT 'no active grant yet (expected right after migration)',
       CASE WHEN (SELECT count(*) FROM "ResellerAutonomyRule" WHERE "revokedAt" IS NULL) = 0 THEN 'ok' ELSE 'has grants' END;
