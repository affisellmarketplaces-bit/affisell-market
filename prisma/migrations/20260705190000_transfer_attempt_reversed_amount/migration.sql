-- Track cumulative Connect reversal per transfer attempt (partial refund safe).

ALTER TABLE "TransferAttempt" ADD COLUMN "reversedAmountCents" INTEGER NOT NULL DEFAULT 0;

-- Backfill from persisted TransferReversal audit rows.
UPDATE "TransferAttempt" ta
SET "reversedAmountCents" = LEAST(
  ta."amountCents",
  COALESCE(sub.total_reversed, 0)
)
FROM (
  SELECT
    tr."stripeTransferId",
    SUM(tr."amountCents") AS total_reversed
  FROM "TransferReversal" tr
  WHERE tr.status IN ('SUCCESS', 'PARTIAL')
  GROUP BY tr."stripeTransferId"
) sub
WHERE ta."stripeTransferId" = sub."stripeTransferId"
  AND ta."status" = 'SUCCESS';
