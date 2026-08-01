-- Affisell Protocole LÉGION — Semaine 1 (spec SQL)
-- Note: Affisell runtime uses Prisma/Neon + NextAuth (User.id cuid).
-- This file documents the Légion schema; production apply via prisma/migrations/*_legion_week1.

-- store_profiles
CREATE TABLE IF NOT EXISTS store_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  display_name text,
  bio text,
  avatar_url text,
  tiktok_url text,
  instagram_url text,
  is_active boolean NOT NULL DEFAULT true,
  total_sales integer NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_profiles_username_format CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  CONSTRAINT store_profiles_username_unique UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS store_profiles_username_idx ON store_profiles (username);
CREATE INDEX IF NOT EXISTS store_profiles_user_id_idx ON store_profiles (user_id);

-- legion_referrals
CREATE TABLE IF NOT EXISTS legion_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES store_profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES store_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  override_rate numeric NOT NULL DEFAULT 0.02,
  total_override_earned numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legion_referrals_referred_unique UNIQUE (referred_id)
);

CREATE INDEX IF NOT EXISTS legion_referrals_sponsor_idx ON legion_referrals (sponsor_id);
CREATE INDEX IF NOT EXISTS legion_referrals_referred_idx ON legion_referrals (referred_id);

-- orders extensions (nullable — never break existing Connect/Lightning)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Order'
  ) THEN
    ALTER TABLE "Order"
      ADD COLUMN IF NOT EXISTS store_profile_id uuid REFERENCES store_profiles(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS legion_override_amount numeric DEFAULT 0,
      ADD COLUMN IF NOT EXISTS legion_payout_status text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS legion_payout_due_at timestamptz,
      ADD COLUMN IF NOT EXISTS legion_supplier_amount numeric,
      ADD COLUMN IF NOT EXISTS legion_reserve_amount numeric;
  END IF;
END $$;

-- RLS (Supabase-style; Affisell enforces via NextAuth + API)
ALTER TABLE store_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE legion_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active stores" ON store_profiles;
CREATE POLICY "Public read active stores" ON store_profiles
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Users manage own store" ON store_profiles;
CREATE POLICY "Users manage own store" ON store_profiles
  FOR ALL USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Legion public read" ON legion_referrals;
CREATE POLICY "Legion public read" ON legion_referrals
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Legion insert via API" ON legion_referrals;
CREATE POLICY "Legion insert via API" ON legion_referrals
  FOR INSERT WITH CHECK (true);
