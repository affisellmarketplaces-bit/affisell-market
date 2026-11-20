-- AFFISELL INTELLIGENCE — decision and experiment journal (the learning loop). Additive and isolated: two new tables,
-- no change to an existing table, no foreign key to the rest of the schema (read defensively: a missing table = an
-- empty journal, never a crash).
--
--   * "IntelligenceDecision"  what the founder decided about a cockpit signal, WHY, and — when the signal maps to a
--                             metric Affisell can measure itself — the baseline measured BY THE SERVER at decision time
--                             (never typed by a person) and the date the result is due. The signal as it was shown is
--                             kept in "signalSnapshot". At most ONE open (measurable, not yet measured) decision per
--                             signal: partial unique index below.
--   * "IntelligenceOutcome"   the measurement of a decision, ONCE (UNIQUE "decisionId"): the same metric over a window of
--                             the same length after the decision, and a verdict that is "inconclusive" unless the change
--                             exceeds ordinary randomness. Written by the server from the database, never entered by hand.

CREATE TABLE IF NOT EXISTS "IntelligenceDecision" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "signalKind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "metric" TEXT,
    "metricScope" TEXT,
    "desiredDirection" TEXT,
    "baselineValue" DOUBLE PRECISION,
    "baselineCount" INTEGER,
    "baselineBase" INTEGER,
    "baselineFrom" TIMESTAMP(3),
    "baselineTo" TIMESTAMP(3),
    "measureAfterDays" INTEGER,
    "dueAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "decidedById" TEXT NOT NULL,
    "signalSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceDecision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntelligenceDecision_decision_check" CHECK ("decision" IN ('act', 'experiment', 'watch', 'dismiss')),
    CONSTRAINT "IntelligenceDecision_status_check" CHECK ("status" IN ('open', 'measured', 'closed')),
    CONSTRAINT "IntelligenceDecision_rationale_check" CHECK (char_length("rationale") BETWEEN 3 AND 2000),
    CONSTRAINT "IntelligenceDecision_metric_check" CHECK ("metric" IS NULL OR "metric" ~ '^[a-z_]{1,40}$'),
    CONSTRAINT "IntelligenceDecision_direction_check" CHECK ("desiredDirection" IS NULL OR "desiredDirection" IN ('up', 'down')),
    CONSTRAINT "IntelligenceDecision_days_check" CHECK ("measureAfterDays" IS NULL OR "measureAfterDays" BETWEEN 7 AND 180),
    -- A measurable decision carries everything its measurement needs, a non-measurable one none of it.
    CONSTRAINT "IntelligenceDecision_measurable_check" CHECK (
        ("metric" IS NULL AND "dueAt" IS NULL AND "baselineValue" IS NULL AND "measureAfterDays" IS NULL)
        OR ("metric" IS NOT NULL AND "dueAt" IS NOT NULL AND "baselineValue" IS NOT NULL AND "measureAfterDays" IS NOT NULL
            AND "desiredDirection" IS NOT NULL AND "baselineFrom" IS NOT NULL AND "baselineTo" IS NOT NULL)
    ),
    CONSTRAINT "IntelligenceDecision_open_check" CHECK ("status" <> 'open' OR "metric" IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntelligenceDecision_signalId_open_key"
    ON "IntelligenceDecision" ("signalId") WHERE "status" = 'open';

CREATE INDEX IF NOT EXISTS "IntelligenceDecision_signalId_createdAt_idx"
    ON "IntelligenceDecision" ("signalId", "createdAt");

CREATE INDEX IF NOT EXISTS "IntelligenceDecision_status_dueAt_idx"
    ON "IntelligenceDecision" ("status", "dueAt");

CREATE TABLE IF NOT EXISTS "IntelligenceOutcome" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "observedValue" DOUBLE PRECISION NOT NULL,
    "observedCount" INTEGER,
    "observedBase" INTEGER,
    "windowFrom" TIMESTAMP(3) NOT NULL,
    "windowTo" TIMESTAMP(3) NOT NULL,
    "zScore" DOUBLE PRECISION,
    "verdict" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "measuredById" TEXT,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelligenceOutcome_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IntelligenceOutcome_verdict_check" CHECK ("verdict" IN ('improved', 'worsened', 'inconclusive')),
    CONSTRAINT "IntelligenceOutcome_window_check" CHECK ("windowTo" > "windowFrom")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IntelligenceOutcome_decisionId_key"
    ON "IntelligenceOutcome" ("decisionId");
