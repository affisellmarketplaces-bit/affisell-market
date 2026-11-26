-- STAGING ONLY. Proves the database refuses every out-of-limit grant and serialises the quota. Writes nothing that
-- survives: everything runs inside a transaction that is ROLLED BACK. Needs one existing user id: psql -v uid="'<id>'".
-- Expected: three NOTICE lines ending in « refused », then ROLLBACK.
BEGIN;
SELECT set_config('t.uid', :uid, true);
SAVEPOINT s;
DO $$ BEGIN
  BEGIN INSERT INTO "ResellerAutonomyRule" ("id","affiliateId","actionType","updatedAt") VALUES ('t1', current_setting('t.uid'), 'pause', NOW());
    RAISE NOTICE 'pause type: ACCEPTED (bug)'; EXCEPTION WHEN check_violation THEN RAISE NOTICE 'pause type: refused'; END;
  BEGIN INSERT INTO "ResellerAutonomyRule" ("id","affiliateId","actionType","maxPriceIncreaseBps","updatedAt") VALUES ('t2', current_setting('t.uid'), 'reprice', 3000, NOW());
    RAISE NOTICE '+30 %% cap: ACCEPTED (bug)'; EXCEPTION WHEN check_violation THEN RAISE NOTICE '+30 %% cap: refused'; END;
  BEGIN INSERT INTO "ResellerAutonomyRule" ("id","affiliateId","actionType","maxRunsPerWeek","updatedAt") VALUES ('t3', current_setting('t.uid'), 'reprice', 0, NOW());
    RAISE NOTICE '0 runs: ACCEPTED (bug)'; EXCEPTION WHEN check_violation THEN RAISE NOTICE '0 runs: refused'; END;
END $$;
ROLLBACK TO SAVEPOINT s;
ROLLBACK;
