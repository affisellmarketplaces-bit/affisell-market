-- Optional color/size the affiliate wants to highlight for this listing (PDP default selection).
ALTER TABLE "AffiliateProduct" ADD COLUMN "promotedColor" TEXT;
ALTER TABLE "AffiliateProduct" ADD COLUMN "promotedSize" TEXT;
