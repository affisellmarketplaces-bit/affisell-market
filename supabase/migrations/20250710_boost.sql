-- Affisell Protocole LÉGION — Semaine 2 BOOST (spec SQL)
-- Runtime: Prisma/Neon — apply via prisma/migrations/*_legion_boost_week2

CREATE TABLE IF NOT EXISTS legion_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL,
  product_id text NOT NULL,
  product_title text,
  old_margin_rate numeric NOT NULL DEFAULT 0.30,
  boost_margin_rate numeric NOT NULL CHECK (boost_margin_rate >= 0.35 AND boost_margin_rate <= 0.50),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  army_notified_count integer NOT NULL DEFAULT 0,
  boost_sales_count integer NOT NULL DEFAULT 0,
  boost_gmv numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legion_boosts_status_ends_at_idx
  ON legion_boosts (status, ends_at);

-- Public read active boosts still running
ALTER TABLE legion_boosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active boosts" ON legion_boosts;
CREATE POLICY "Public read active boosts" ON legion_boosts
  FOR SELECT USING (status = 'active' AND ends_at > now());

DROP POLICY IF EXISTS "Suppliers manage own boosts" ON legion_boosts;
CREATE POLICY "Suppliers manage own boosts" ON legion_boosts
  FOR ALL USING (true)
  WITH CHECK (true);

-- Expire overdue boosts (idempotent)
CREATE OR REPLACE FUNCTION expire_boosts()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE legion_boosts
  SET status = 'expired'
  WHERE status = 'active'
    AND ends_at <= now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
