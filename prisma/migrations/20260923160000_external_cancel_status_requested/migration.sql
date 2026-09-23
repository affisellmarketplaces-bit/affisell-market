-- AliExpress's aliexpress.ds.order.afterpay accepts a cancellation request but doesn't
-- guarantee an instant cancel (seller approval may still apply) — REQUESTED distinguishes
-- that from CANCELLED (a channel with a verified, unambiguous cancel outcome).

ALTER TYPE "ExternalCancelStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
