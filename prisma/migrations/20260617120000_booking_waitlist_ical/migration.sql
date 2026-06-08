-- Phase 12: waitlist for sold-out slots
CREATE TABLE "BookingWaitlist" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "notifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingWaitlist_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingWaitlist_slotId_email_key" ON "BookingWaitlist"("slotId", "email");
CREATE INDEX "BookingWaitlist_slotId_notifiedAt_createdAt_idx" ON "BookingWaitlist"("slotId", "notifiedAt", "createdAt");
CREATE INDEX "BookingWaitlist_productId_idx" ON "BookingWaitlist"("productId");

ALTER TABLE "BookingWaitlist" ADD CONSTRAINT "BookingWaitlist_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "BookingSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingWaitlist" ADD CONSTRAINT "BookingWaitlist_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingWaitlist" ADD CONSTRAINT "BookingWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
