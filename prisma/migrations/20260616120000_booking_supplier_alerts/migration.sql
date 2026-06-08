-- Phase 11: supplier booking alert + J-0 digest idempotence
ALTER TABLE "Order" ADD COLUMN "bookingSupplierAlertSentAt" TIMESTAMPTZ;
ALTER TABLE "Order" ADD COLUMN "bookingSupplierDigestSentAt" TIMESTAMPTZ;
