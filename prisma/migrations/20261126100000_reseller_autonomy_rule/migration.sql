-- Reseller copilot autonomy: one explicit, revocable grant per action type. Additive, isolated table.
-- The CHECK constraints are the hard limits: no global grant, no pause/financial action, price rise ≤ 25 %.

CREATE TABLE "ResellerAutonomyRule" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "maxPriceIncreaseBps" INTEGER NOT NULL DEFAULT 1000,
    "maxRunsPerWeek" INTEGER NOT NULL DEFAULT 5,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    -- Atomic run quota: a run RESERVES a slot with one conditional UPDATE (row lock), so two concurrent cron runs can
    -- never both pass the limit; the window restarts 7 days after its first run.
    "autoRunsWindowStart" TIMESTAMP(3),
    "autoRunsInWindow" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResellerAutonomyRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResellerAutonomyRule_actionType_check" CHECK ("actionType" IN ('fix_margins', 'reprice')),
    CONSTRAINT "ResellerAutonomyRule_maxPriceIncreaseBps_check" CHECK ("maxPriceIncreaseBps" BETWEEN 0 AND 2500),
    CONSTRAINT "ResellerAutonomyRule_maxRunsPerWeek_check" CHECK ("maxRunsPerWeek" BETWEEN 1 AND 50),
    -- Bounded by the largest cap, NOT by the current one: lowering the cap must never erase runs already used in the
    -- window (a later raise would then allow more than the cap). A lower cap simply stops the next reservation.
    CONSTRAINT "ResellerAutonomyRule_autoRunsInWindow_check" CHECK ("autoRunsInWindow" BETWEEN 0 AND 50)
);

CREATE UNIQUE INDEX "ResellerAutonomyRule_affiliateId_actionType_key" ON "ResellerAutonomyRule"("affiliateId", "actionType");

ALTER TABLE "ResellerAutonomyRule" ADD CONSTRAINT "ResellerAutonomyRule_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
