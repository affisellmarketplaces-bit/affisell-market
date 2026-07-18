-- Affisell Radar commercial tier (Stripe upgrade /pricing?feature=radar)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "radarPlan" TEXT NOT NULL DEFAULT 'free';
