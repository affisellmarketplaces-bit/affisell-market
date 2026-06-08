-- Phase 2: checkout holds + buyer cancellation timestamps

ALTER TABLE "BookingSlot" ADD COLUMN IF NOT EXISTS "heldCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bookingHoldExpiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "bookingCancelledAt" TIMESTAMP(3);
