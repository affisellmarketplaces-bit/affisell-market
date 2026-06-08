-- Phase 10: buyer phone for SMS reminders + idempotent H-2 SMS
ALTER TABLE "Order" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "Order" ADD COLUMN "bookingReminderHourSmsSentAt" TIMESTAMPTZ;
