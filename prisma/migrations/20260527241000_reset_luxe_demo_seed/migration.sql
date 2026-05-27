-- Remove auto-seed / legacy demo flags so /luxe stays empty until supplier opt-in.
UPDATE "Product" SET "isLuxury" = false WHERE "isLuxury" = true;

UPDATE "AffiliateProduct"
SET "luxuryTier" = 'NONE', "luxuryCollectionId" = NULL
WHERE "luxuryTier" <> 'NONE' OR "luxuryCollectionId" IS NOT NULL;
