-- AFFISELL INTELLIGENCE — signal log (scheduled cockpit runs). Additive and isolated: one new table, no change to an
-- existing table, no foreign key (read defensively: a missing table = "no history", never a crash).
--
--   * "IntelligenceSignalLog"  one row per signal id ever raised by a SCHEDULED run (the daily cron; a page view never
--                              writes). First / last time seen, how many runs saw it, its latest snapshot. "notifiedAt" is
--                              the claim of the founder notification: set by an UPDATE … WHERE "notifiedAt" IS NULL, so a
--                              signal is announced at most once, whatever the number of concurrent or repeated runs.

CREATE TABLE IF NOT EXISTS "IntelligenceSignalLog" (
    "signalId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "timesSeen" INTEGER NOT NULL DEFAULT 1,
    "lastSnapshot" JSONB NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "notifyResult" TEXT,

    CONSTRAINT "IntelligenceSignalLog_pkey" PRIMARY KEY ("signalId"),
    CONSTRAINT "IntelligenceSignalLog_priority_check" CHECK ("priority" IN ('critical', 'important', 'study')),
    CONSTRAINT "IntelligenceSignalLog_seen_check" CHECK ("lastSeenAt" >= "firstSeenAt" AND "timesSeen" >= 1),
    CONSTRAINT "IntelligenceSignalLog_notify_check" CHECK ("notifyResult" IS NULL OR "notifyResult" IN ('sent', 'no_channel', 'failed'))
);

CREATE INDEX IF NOT EXISTS "IntelligenceSignalLog_lastSeenAt_idx"
    ON "IntelligenceSignalLog" ("lastSeenAt");
