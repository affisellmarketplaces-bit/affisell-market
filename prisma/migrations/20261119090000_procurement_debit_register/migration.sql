-- PROCUREMENT DEBIT REGISTER — what was REALLY taken from Affisell's accounts to buy goods from a source, and which
-- orders each amount belongs to. Additive and isolated: two new tables, no change to an existing table, no foreign key
-- to the rest of the schema (read defensively: a missing table = "register unavailable", never a crash). Nothing here
-- moves money: rows are recorded by an admin from a statement or read from a payment source.
--
--   * "ProcurementDebit"            one money movement observed at its source: a DEBIT (card capture, bank debit), a
--                                   REFUND of a debit, or a FEE (card / FX / customs). Original amount and currency as
--                                   charged; the SETTLED amount in euros once known (FX). Unique per (source, reference):
--                                   the same transaction can not be recorded twice. Never deleted: voided with a reason.
--   * "ProcurementDebitAllocation"  the reconciliation of one movement (or part of it) to ONE order, in settled euros.
--                                   At most one ACTIVE allocation per (movement, order) — partial unique index; the active
--                                   allocations of a movement never exceed its settled amount — trigger below, which
--                                   locks the movement row. Revoked, never deleted.
-- A stored source price (Order.aeWholesaleCents) is NOT a debit and never enters these tables.

CREATE TABLE IF NOT EXISTS "ProcurementDebit" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "settledAmountCents" INTEGER,
    "settledCurrency" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "parentDebitId" TEXT,
    "includesDelivery" BOOLEAN,
    "vatTreatment" TEXT NOT NULL DEFAULT 'unknown',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "voidReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementDebit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProcurementDebit_kind_check" CHECK ("kind" IN ('debit', 'refund', 'fee')),
    CONSTRAINT "ProcurementDebit_source_check" CHECK ("source" IN ('stripe_issuing', 'card_statement', 'bank_statement', 'supplier_invoice_paid')),
    CONSTRAINT "ProcurementDebit_reference_check" CHECK (char_length("sourceReference") BETWEEN 1 AND 200),
    CONSTRAINT "ProcurementDebit_amount_check" CHECK ("amountCents" > 0),
    CONSTRAINT "ProcurementDebit_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
    -- Settled amount and currency come together, in euros, strictly positive.
    CONSTRAINT "ProcurementDebit_settled_check" CHECK (
        ("settledAmountCents" IS NULL AND "settledCurrency" IS NULL)
        OR ("settledAmountCents" > 0 AND "settledCurrency" = 'EUR')
    ),
    -- An amount charged in euros IS its settled amount: no room for a second figure.
    CONSTRAINT "ProcurementDebit_eur_settled_check" CHECK ("currency" <> 'EUR' OR ("settledAmountCents" IS NOT NULL AND "settledAmountCents" = "amountCents")),
    -- A refund always belongs to the debit it gives back; a debit is never a child.
    CONSTRAINT "ProcurementDebit_parent_check" CHECK (
        ("kind" = 'debit' AND "parentDebitId" IS NULL) OR ("kind" = 'refund' AND "parentDebitId" IS NOT NULL) OR "kind" = 'fee'
    ),
    CONSTRAINT "ProcurementDebit_vat_check" CHECK ("vatTreatment" IN ('included', 'excluded', 'unknown')),
    CONSTRAINT "ProcurementDebit_status_check" CHECK ("status" IN ('recorded', 'voided')),
    CONSTRAINT "ProcurementDebit_void_check" CHECK (
        ("status" = 'recorded' AND "voidReason" IS NULL AND "voidedAt" IS NULL AND "voidedById" IS NULL)
        OR ("status" = 'voided' AND char_length("voidReason") >= 3 AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL)
    ),
    CONSTRAINT "ProcurementDebit_parentDebitId_fkey" FOREIGN KEY ("parentDebitId") REFERENCES "ProcurementDebit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcurementDebit_source_sourceReference_key"
    ON "ProcurementDebit" ("source", "sourceReference");

CREATE INDEX IF NOT EXISTS "ProcurementDebit_parentDebitId_idx" ON "ProcurementDebit" ("parentDebitId");

CREATE INDEX IF NOT EXISTS "ProcurementDebit_occurredAt_idx" ON "ProcurementDebit" ("occurredAt");

CREATE TABLE IF NOT EXISTS "ProcurementDebitAllocation" (
    "id" TEXT NOT NULL,
    "debitId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "basis" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "allocatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "ProcurementDebitAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProcurementDebitAllocation_amount_check" CHECK ("amountCents" > 0),
    CONSTRAINT "ProcurementDebitAllocation_basis_check" CHECK ("basis" IN ('single_order', 'grouped_split', 'partial_payment', 'manual')),
    CONSTRAINT "ProcurementDebitAllocation_status_check" CHECK ("status" IN ('active', 'revoked')),
    CONSTRAINT "ProcurementDebitAllocation_revoke_check" CHECK (
        ("status" = 'active' AND "revokedAt" IS NULL AND "revokedById" IS NULL AND "revokeReason" IS NULL)
        OR ("status" = 'revoked' AND "revokedAt" IS NOT NULL AND "revokedById" IS NOT NULL AND char_length("revokeReason") >= 3)
    ),
    CONSTRAINT "ProcurementDebitAllocation_debitId_fkey" FOREIGN KEY ("debitId") REFERENCES "ProcurementDebit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProcurementDebitAllocation_debitId_orderId_active_key"
    ON "ProcurementDebitAllocation" ("debitId", "orderId") WHERE "status" = 'active';

CREATE INDEX IF NOT EXISTS "ProcurementDebitAllocation_orderId_idx" ON "ProcurementDebitAllocation" ("orderId");

CREATE INDEX IF NOT EXISTS "ProcurementDebitAllocation_debitId_idx" ON "ProcurementDebitAllocation" ("debitId");

-- No double counting, whatever writes: an ACTIVE allocation needs a recorded movement with a settled amount, and the
-- active allocations of one movement never exceed it. The movement row is locked, so two concurrent allocations of the
-- same movement are checked one after the other.
CREATE OR REPLACE FUNCTION affisell_procurement_allocation_within_debit() RETURNS trigger AS $$
DECLARE
    cap INTEGER;
    used BIGINT;
BEGIN
    IF NEW."status" <> 'active' THEN
        RETURN NEW;
    END IF;
    SELECT "settledAmountCents" INTO cap FROM "ProcurementDebit"
        WHERE "id" = NEW."debitId" AND "status" = 'recorded' FOR UPDATE;
    IF cap IS NULL THEN
        RAISE EXCEPTION 'procurement_debit_not_allocatable' USING ERRCODE = 'check_violation';
    END IF;
    SELECT COALESCE(SUM("amountCents"), 0) INTO used FROM "ProcurementDebitAllocation"
        WHERE "debitId" = NEW."debitId" AND "status" = 'active' AND "id" <> NEW."id";
    IF used + NEW."amountCents" > cap THEN
        RAISE EXCEPTION 'procurement_debit_over_allocated' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProcurementDebitAllocation_within_debit" ON "ProcurementDebitAllocation";
CREATE TRIGGER "ProcurementDebitAllocation_within_debit"
    BEFORE INSERT OR UPDATE ON "ProcurementDebitAllocation"
    FOR EACH ROW EXECUTE FUNCTION affisell_procurement_allocation_within_debit();
