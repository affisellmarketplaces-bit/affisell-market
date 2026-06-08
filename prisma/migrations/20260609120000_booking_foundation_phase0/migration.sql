-- Phase 0: booking foundation (SERVICE / EXPERIENCE listing kinds)

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bookingDurationMinutes" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bookingCancellationHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bookingVenueLabel" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bookingInstantConfirm" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bookingSlotId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bookingSnapshot" JSONB;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bookingToken" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bookingConfirmedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_bookingToken_key" ON "Order"("bookingToken");

CREATE TABLE IF NOT EXISTS "BookingSlot" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "priceCentsOverride" INTEGER,
    "label" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BookingSlot_productId_startsAt_idx" ON "BookingSlot"("productId", "startsAt");
CREATE INDEX IF NOT EXISTS "BookingSlot_status_startsAt_idx" ON "BookingSlot"("status", "startsAt");

DO $$ BEGIN
  ALTER TABLE "BookingSlot" ADD CONSTRAINT "BookingSlot_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Order" ADD CONSTRAINT "Order_bookingSlotId_fkey"
    FOREIGN KEY ("bookingSlotId") REFERENCES "BookingSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Product_listingKind_idx" ON "Product"("listingKind");
