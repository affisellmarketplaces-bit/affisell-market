-- Phase 13: waitlist SMS + buyer calendar
ALTER TABLE "BookingWaitlist" ADD COLUMN "phone" TEXT;
ALTER TABLE "BookingWaitlist" ADD COLUMN "smsNotifiedAt" TIMESTAMPTZ;
