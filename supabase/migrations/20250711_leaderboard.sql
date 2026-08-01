-- Affisell Protocole LÉGION — Semaine 3 LEADERBOARD (spec SQL)
-- Runtime: Prisma/Neon — apply via prisma/migrations/*_legion_leaderboard_week3
--
-- Maps Affisell Order fields:
--   total_amount     → selling_price / 100 (HT GMV)
--   seller_earnings  → affiliate payout + margin retained / 100
--   payout_status    → payoutStatus (exclude FAILED)
--   created_at window→ paidAt BETWEEN boost starts/ends

CREATE INDEX IF NOT EXISTS idx_orders_leaderboard
  ON orders (product_id, created_at, store_profile_id)
  WHERE payout_status IS DISTINCT FROM 'failed';

CREATE OR REPLACE VIEW legion_leaderboard AS
SELECT
  lb.id AS boost_id,
  lb.product_id,
  lb.product_title,
  lb.boost_margin_rate,
  lb.ends_at,
  sp.username,
  sp.display_name,
  sp.avatar_url,
  COUNT(o.id)::integer AS sales_count,
  COALESCE(SUM(o.total_amount), 0)::numeric AS total_gmv,
  COALESCE(SUM(o.seller_earnings), 0)::numeric AS total_earnings
FROM legion_boosts lb
JOIN orders o
  ON o.product_id = lb.product_id
 AND o.created_at BETWEEN lb.starts_at AND lb.ends_at
 AND COALESCE(o.payout_status, '') <> 'failed'
JOIN store_profiles sp
  ON sp.id = o.store_profile_id
WHERE lb.status = 'active'
GROUP BY
  lb.id,
  lb.product_id,
  lb.product_title,
  lb.boost_margin_rate,
  lb.ends_at,
  sp.username,
  sp.display_name,
  sp.avatar_url;
