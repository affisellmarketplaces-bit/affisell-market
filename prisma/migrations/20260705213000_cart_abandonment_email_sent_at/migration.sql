-- Proactive cart abandonment email idempotency on Cart.

ALTER TABLE "Cart" ADD COLUMN "cartAbandonmentEmailSentAt" TIMESTAMP(3);
