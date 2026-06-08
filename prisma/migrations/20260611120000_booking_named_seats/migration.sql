-- Phase 3: nominative cinema seats (A12, B4…)

CREATE TABLE IF NOT EXISTS "BookingSeat" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "rowIndex" INTEGER NOT NULL,
  "colIndex" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "orderId" TEXT,
  "holdExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingSeat_slotId_label_key" ON "BookingSeat"("slotId", "label");
CREATE INDEX IF NOT EXISTS "BookingSeat_slotId_status_idx" ON "BookingSeat"("slotId", "status");
CREATE INDEX IF NOT EXISTS "BookingSeat_orderId_idx" ON "BookingSeat"("orderId");

DO $$ BEGIN
  ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_slotId_fkey"
    FOREIGN KEY ("slotId") REFERENCES "BookingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingSeat" ADD CONSTRAINT "BookingSeat_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
