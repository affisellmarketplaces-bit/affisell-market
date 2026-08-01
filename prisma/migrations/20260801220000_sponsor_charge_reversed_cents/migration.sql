-- Affisell Placement — proportional SUCCESS_FEE clawback on partial refunds

ALTER TABLE "SponsorCampaignCharge" ADD COLUMN IF NOT EXISTS "reversedCents" INTEGER NOT NULL DEFAULT 0;
