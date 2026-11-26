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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResellerAutonomyRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResellerAutonomyRule_actionType_check" CHECK ("actionType" IN ('fix_margins', 'reprice')),
    CONSTRAINT "ResellerAutonomyRule_maxPriceIncreaseBps_check" CHECK ("maxPriceIncreaseBps" BETWEEN 0 AND 2500),
    CONSTRAINT "ResellerAutonomyRule_maxRunsPerWeek_check" CHECK ("maxRunsPerWeek" BETWEEN 1 AND 50)
);

CREATE UNIQUE INDEX "ResellerAutonomyRule_affiliateId_actionType_key" ON "ResellerAutonomyRule"("affiliateId", "actionType");

ALTER TABLE "ResellerAutonomyRule" ADD CONSTRAINT "ResellerAutonomyRule_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
