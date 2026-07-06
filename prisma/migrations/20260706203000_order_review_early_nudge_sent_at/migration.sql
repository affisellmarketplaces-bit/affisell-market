-- J+3 review push nudge (idempotent per order)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reviewEarlyNudgeSentAt" TIMESTAMP(3);
