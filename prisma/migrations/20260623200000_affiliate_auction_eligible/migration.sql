-- Affiliate chooses which storefront listings appear in Auction Arena.
ALTER TABLE "AffiliateProduct" ADD COLUMN "auctionEligible" BOOLEAN NOT NULL DEFAULT false;
