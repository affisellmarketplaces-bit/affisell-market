-- Payout leg registry: ONE row per payout that may be paid at most once (docs/PAYOUT-LEG-REGISTRY.md).
-- Additive only: a new table, its constraints, one guard trigger. Nothing existing is read, changed or backfilled.
-- APPLY BY HAND before the push that ships lib/payouts/leg-transfer.server.ts (`npm run schema:migrate`); without the
-- table every payout answers `registry_unavailable` and NOTHING is paid (fail closed, attempts are not consumed).
-- Rollback: scripts/migration-rollbacks/20261125090000_payout_leg_registry.down.sql (destructive: drops the registry).

-- CreateTable
CREATE TABLE "PayoutLeg" (
    "id" TEXT NOT NULL,
    "legKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "orderId" TEXT,
    "role" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "transferGroup" TEXT NOT NULL,
    "rail" TEXT,
    "paidRail" TEXT,
    "idempotencyKey" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT,
    "destination" TEXT,
    "paramsHash" TEXT,
    "params" JSONB,
    "stripeTransferId" TEXT,
    "adopted" BOOLEAN NOT NULL DEFAULT false,
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "inDoubtReason" TEXT,
    "inDoubtAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutLeg_legKey_key" ON "PayoutLeg"("legKey");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutLeg_stripeTransferId_key" ON "PayoutLeg"("stripeTransferId");

-- CreateIndex
CREATE INDEX "PayoutLeg_state_updatedAt_idx" ON "PayoutLeg"("state", "updatedAt");

-- CreateIndex
CREATE INDEX "PayoutLeg_orderId_idx" ON "PayoutLeg"("orderId");

-- Guards: closed vocabularies and what each state requires.
ALTER TABLE "PayoutLeg"
  ADD CONSTRAINT "PayoutLeg_state_check"
    CHECK ("state" IN ('PENDING', 'PROCESSING', 'PAID', 'IN_DOUBT', 'FAILED_CONFIRMED')),
  ADD CONSTRAINT "PayoutLeg_kind_check"
    CHECK ("kind" IN ('order', 'blind_dropship', 'auto_order', 'agent_withdrawal')),
  ADD CONSTRAINT "PayoutLeg_role_check"
    CHECK ("role" IN ('SUPPLIER', 'AFFILIATE', 'LEGION_SPONSOR', 'BLIND_SUPPLIER', 'AUTO_ORDER_PROVIDER', 'AGENT')),
  ADD CONSTRAINT "PayoutLeg_order_kind_check"
    CHECK ("kind" <> 'order' OR ("orderId" IS NOT NULL AND "role" IN ('SUPPLIER', 'AFFILIATE', 'LEGION_SPONSOR'))),
  ADD CONSTRAINT "PayoutLeg_generation_check" CHECK ("generation" >= 1),
  ADD CONSTRAINT "PayoutLeg_amount_check" CHECK ("amountCents" IS NULL OR "amountCents" > 0),
  ADD CONSTRAINT "PayoutLeg_transfer_id_shape_check"
    CHECK ("stripeTransferId" IS NULL OR "stripeTransferId" ~ '^tr_[^[:space:]]+$'),
  -- A transfer id exists exactly on PAID legs.
  ADD CONSTRAINT "PayoutLeg_paid_check"
    CHECK (("state" = 'PAID') = ("stripeTransferId" IS NOT NULL) AND ("state" <> 'PAID' OR "paidAt" IS NOT NULL)),
  -- No Stripe call without a claim, a frozen request and its idempotency key.
  ADD CONSTRAINT "PayoutLeg_processing_check"
    CHECK ("state" <> 'PROCESSING' OR ("claimToken" IS NOT NULL AND "claimedAt" IS NOT NULL
      AND "paramsHash" IS NOT NULL AND "params" IS NOT NULL AND "idempotencyKey" IS NOT NULL)),
  ADD CONSTRAINT "PayoutLeg_in_doubt_check"
    CHECK ("state" <> 'IN_DOUBT' OR ("inDoubtReason" IS NOT NULL AND "inDoubtAt" IS NOT NULL));

-- Guard trigger: legal transitions only, frozen identity and parameters, no deletion.
CREATE OR REPLACE FUNCTION "affisell_payout_leg_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF coalesce(current_setting('affisell.payout_leg_purge', true), '') = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'PayoutLeg rows are never deleted (leg %)', OLD."legKey" USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."state" NOT IN ('PENDING', 'PROCESSING', 'PAID', 'IN_DOUBT') THEN
      RAISE EXCEPTION 'PayoutLeg can not be created in state %', NEW."state" USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW."legKey" IS DISTINCT FROM OLD."legKey" OR NEW."kind" IS DISTINCT FROM OLD."kind"
     OR NEW."orderId" IS DISTINCT FROM OLD."orderId" OR NEW."role" IS DISTINCT FROM OLD."role"
     OR NEW."transferGroup" IS DISTINCT FROM OLD."transferGroup" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'PayoutLeg identity is immutable (leg %)', OLD."legKey" USING ERRCODE = 'check_violation';
  END IF;

  IF NEW."generation" < OLD."generation" THEN
    RAISE EXCEPTION 'PayoutLeg generation never decreases (leg %)', OLD."legKey" USING ERRCODE = 'check_violation';
  END IF;

  -- Within one generation the frozen request and its idempotency key never change once set.
  IF NEW."generation" = OLD."generation" THEN
    IF OLD."paramsHash" IS NOT NULL AND NEW."paramsHash" IS DISTINCT FROM OLD."paramsHash" THEN
      RAISE EXCEPTION 'PayoutLeg frozen parameters changed (leg %)', OLD."legKey" USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."params" IS NOT NULL AND NEW."params" IS DISTINCT FROM OLD."params" THEN
      RAISE EXCEPTION 'PayoutLeg frozen request changed (leg %)', OLD."legKey" USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."idempotencyKey" IS NOT NULL AND NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey" THEN
      RAISE EXCEPTION 'PayoutLeg idempotency key changed (leg %)', OLD."legKey" USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF OLD."state" = 'PAID' THEN
    IF NEW."state" <> 'PAID' OR NEW."stripeTransferId" IS DISTINCT FROM OLD."stripeTransferId"
       OR NEW."generation" <> OLD."generation" THEN
      RAISE EXCEPTION 'PayoutLeg % is PAID: terminal', OLD."legKey" USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."state" IS DISTINCT FROM OLD."state" THEN
    IF NOT (
      (OLD."state" = 'PENDING' AND NEW."state" IN ('PROCESSING', 'PAID', 'IN_DOUBT'))
      OR (OLD."state" = 'PROCESSING' AND NEW."state" IN ('PAID', 'IN_DOUBT', 'FAILED_CONFIRMED', 'PENDING'))
      OR (OLD."state" = 'FAILED_CONFIRMED' AND NEW."state" IN ('PROCESSING', 'PAID', 'IN_DOUBT'))
      OR (OLD."state" = 'IN_DOUBT' AND NEW."state" IN ('PAID', 'FAILED_CONFIRMED'))
    ) THEN
      RAISE EXCEPTION 'PayoutLeg transition % -> % refused (leg %)', OLD."state", NEW."state", OLD."legKey"
        USING ERRCODE = 'check_violation';
    END IF;
    -- A doubt is closed as "not paid" only by a named person.
    IF OLD."state" = 'IN_DOUBT' AND NEW."state" = 'FAILED_CONFIRMED' AND NEW."resolvedBy" IS NULL THEN
      RAISE EXCEPTION 'PayoutLeg % : IN_DOUBT -> FAILED_CONFIRMED needs resolvedBy', OLD."legKey"
        USING ERRCODE = 'check_violation';
    END IF;
    -- A new attempt after a proved failure is a NEW generation (new idempotency key); a claim of a pending leg is not.
    IF OLD."state" = 'FAILED_CONFIRMED' AND NEW."state" = 'PROCESSING' AND NEW."generation" <> OLD."generation" + 1 THEN
      RAISE EXCEPTION 'PayoutLeg % : a retry after FAILED_CONFIRMED must open generation %', OLD."legKey",
        OLD."generation" + 1 USING ERRCODE = 'check_violation';
    END IF;
    IF OLD."state" = 'PENDING' AND NEW."state" = 'PROCESSING' AND NEW."generation" <> OLD."generation" THEN
      RAISE EXCEPTION 'PayoutLeg % : a pending leg is claimed in its own generation', OLD."legKey"
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."state" <> 'PROCESSING' AND NEW."generation" <> OLD."generation" THEN
    RAISE EXCEPTION 'PayoutLeg % : generation changes only when a claim opens it', OLD."legKey"
      USING ERRCODE = 'check_violation';
  END IF;

  NEW."updatedAt" := (clock_timestamp() AT TIME ZONE 'UTC');
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PayoutLeg_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "PayoutLeg"
  FOR EACH ROW EXECUTE FUNCTION "affisell_payout_leg_guard"();

-- Statement-level TRUNCATE bypasses row triggers: refused too (same deliberate-maintenance switch).
CREATE OR REPLACE FUNCTION "affisell_payout_leg_no_truncate"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('affisell.payout_leg_purge', true), '') = 'on' THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'PayoutLeg is never truncated' USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER "PayoutLeg_no_truncate"
  BEFORE TRUNCATE ON "PayoutLeg"
  FOR EACH STATEMENT EXECUTE FUNCTION "affisell_payout_leg_no_truncate"();
