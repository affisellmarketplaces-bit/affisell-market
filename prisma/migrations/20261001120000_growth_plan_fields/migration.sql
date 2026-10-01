-- Affisell Growth commercial tiers (Lanceur/Dominator/Empire) — Stripe checkout at
-- app/api/stripe/create-growth-checkout, activated by lib/stripe-growth.ts.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "growthPlan" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "growthPlanInterval" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "growthPlanActivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "growthStripeSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "catalogCapBaselineCount" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "User_growthStripeSubscriptionId_key"
  ON "User"("growthStripeSubscriptionId");

-- Item-level import count, persisted for the Growth Lanceur weekly import quota.
ALTER TABLE "ImportJob" ADD COLUMN IF NOT EXISTS "importedCount" INTEGER;
