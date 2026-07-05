-- J+30 repurchase win-back email idempotency guard on Order.

ALTER TABLE "Order" ADD COLUMN "repurchaseReminderSentAt" TIMESTAMP(3);
