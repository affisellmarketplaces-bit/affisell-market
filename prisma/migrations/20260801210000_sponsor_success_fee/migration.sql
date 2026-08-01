-- Affisell Boost SUCCESS_FEE — pay % of HT only after a concluded sale

ALTER TABLE "SponsorCampaign" ADD COLUMN IF NOT EXISTS "billingMode" TEXT NOT NULL DEFAULT 'SUCCESS_FEE';
ALTER TABLE "SponsorCampaign" ADD COLUMN IF NOT EXISTS "accruedFeeCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "SponsorCampaignCharge" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "feeCents" INTEGER NOT NULL,
  "htCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACCRUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SponsorCampaignCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SponsorCampaignCharge_status_check" CHECK ("status" IN ('ACCRUED', 'REVERSED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "SponsorCampaignCharge_orderId_campaignId_key"
  ON "SponsorCampaignCharge"("orderId", "campaignId");
CREATE INDEX IF NOT EXISTS "SponsorCampaignCharge_campaignId_idx"
  ON "SponsorCampaignCharge"("campaignId");
CREATE INDEX IF NOT EXISTS "SponsorCampaignCharge_orderId_idx"
  ON "SponsorCampaignCharge"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SponsorCampaignCharge_campaignId_fkey'
  ) THEN
    ALTER TABLE "SponsorCampaignCharge"
      ADD CONSTRAINT "SponsorCampaignCharge_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "SponsorCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SponsorCampaignCharge_orderId_fkey'
  ) THEN
    ALTER TABLE "SponsorCampaignCharge"
      ADD CONSTRAINT "SponsorCampaignCharge_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
