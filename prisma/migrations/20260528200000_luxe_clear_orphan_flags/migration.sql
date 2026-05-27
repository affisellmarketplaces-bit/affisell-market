-- Idempotent: /luxe only shows supplier opt-in (Product.isLuxury). Clears legacy demo flags.
UPDATE "Product" SET "isLuxury" = false WHERE "isLuxury" = true;

UPDATE "AffiliateProduct"
SET "luxuryTier" = 'NONE', "luxuryCollectionId" = NULL
WHERE "luxuryTier" <> 'NONE' OR "luxuryCollectionId" IS NOT NULL;
