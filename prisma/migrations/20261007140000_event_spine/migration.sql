-- Event spine, step S1: additive columns on "AffisellTrackEvent" (every existing row keeps NULL in each of them).
-- The block below is the exact output of `prisma migrate diff` between the committed schema and the new one.

-- AlterTable
ALTER TABLE "AffisellTrackEvent" ADD COLUMN     "anonymousId" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "eventClass" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "locale" VARCHAR(8),
ADD COLUMN     "occurredAt" TIMESTAMP(3),
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "properties" JSONB,
ADD COLUMN     "schemaVersion" INTEGER,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AffisellTrackEvent_eventId_key" ON "AffisellTrackEvent"("eventId");

-- CreateIndex
CREATE INDEX "AffisellTrackEvent_creatorId_createdAt_idx" ON "AffisellTrackEvent"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "AffisellTrackEvent_orderId_idx" ON "AffisellTrackEvent"("orderId");

-- CreateIndex
CREATE INDEX "AffisellTrackEvent_anonymousId_createdAt_idx" ON "AffisellTrackEvent"("anonymousId", "createdAt");


-- ---------------------------------------------------------------------------------------------------------------
-- Written by hand (Prisma does not model CHECK constraints). They make the separation between the two classes of
-- events a property of the DATABASE, not only of the application code:
--   * "behavioral"    rows are analytics events, recorded only with the visitor's analytics consent;
--   * "transactional" rows are the business journal and must never carry a visitor identifier;
--   * every row written by the spine carries its idempotency key.
-- Rows written before the spine have "eventClass" NULL and satisfy all three constraints unchanged.
-- ---------------------------------------------------------------------------------------------------------------

-- AddCheck
ALTER TABLE "AffisellTrackEvent" ADD CONSTRAINT "AffisellTrackEvent_eventClass_check"
  CHECK ("eventClass" IS NULL OR "eventClass" IN ('behavioral', 'transactional'));

-- AddCheck
ALTER TABLE "AffisellTrackEvent" ADD CONSTRAINT "AffisellTrackEvent_transactional_no_visitor_ids_check"
  CHECK ("eventClass" IS DISTINCT FROM 'transactional' OR ("anonymousId" IS NULL AND "sessionId" IS NULL));

-- AddCheck
ALTER TABLE "AffisellTrackEvent" ADD CONSTRAINT "AffisellTrackEvent_spine_has_event_id_check"
  CHECK ("eventClass" IS NULL OR "eventId" IS NOT NULL);
