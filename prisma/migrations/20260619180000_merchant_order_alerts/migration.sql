-- Idempotent merchant order/sale alerts (in-app + email) on marketplace checkout paid.
ALTER TABLE "Order" ADD COLUMN "merchantSupplierInboxNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "merchantAffiliateInboxNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "merchantSupplierEmailSentAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "merchantAffiliateEmailSentAt" TIMESTAMP(3);
