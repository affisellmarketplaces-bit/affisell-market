-- Affisell LÉGION leaderboard week 3 — Prisma/Neon
-- View + partial index for real-time Battle sales ranking

CREATE INDEX IF NOT EXISTS "idx_orders_leaderboard"
  ON "Order" ("productId", "paidAt", "storeProfileId")
  WHERE "payoutStatus" IS DISTINCT FROM 'FAILED';

-- Prisma schema companion (non-partial) for query planner + migrate parity
CREATE INDEX IF NOT EXISTS "Order_productId_paidAt_storeProfileId_idx"
  ON "Order"("productId", "paidAt", "storeProfileId");

CREATE OR REPLACE VIEW legion_leaderboard AS
SELECT
  lb.id AS boost_id,
  lb."productId" AS product_id,
  lb."productTitle" AS product_title,
  lb."boostMarginRate" AS boost_margin_rate,
  lb."endsAt" AS ends_at,
  sp.username AS username,
  sp."displayName" AS display_name,
  sp."avatarUrl" AS avatar_url,
  COUNT(o.id)::integer AS sales_count,
  ROUND(COALESCE(SUM(o."sellingPriceCents"), 0)::numeric / 100, 2) AS total_gmv,
  ROUND(
    COALESCE(SUM(o."affiliatePayoutCents" + o."affiliateMarginRetainedCents"), 0)::numeric / 100,
    2
  ) AS total_earnings
FROM "LegionBoost" lb
INNER JOIN "Order" o
  ON o."productId" = lb."productId"
 AND o."paidAt" IS NOT NULL
 AND o."paidAt" >= lb."startsAt"
 AND o."paidAt" <= lb."endsAt"
 AND o."payoutStatus" IS DISTINCT FROM 'FAILED'
 AND o.status IS DISTINCT FROM 'refunded'
 AND o."storeProfileId" IS NOT NULL
INNER JOIN "StoreProfile" sp
  ON sp.id = o."storeProfileId"
WHERE lb.status = 'active'
GROUP BY
  lb.id,
  lb."productId",
  lb."productTitle",
  lb."boostMarginRate",
  lb."endsAt",
  sp.username,
  sp."displayName",
  sp."avatarUrl";
