-- Unify Stripe Connect account id on User (drop profile duplicates).

UPDATE "User" u
SET "stripeAccountId" = sp."stripeAccountId"
FROM "SupplierProfile" sp
WHERE sp."userId" = u."id"
  AND u."stripeAccountId" IS NULL
  AND sp."stripeAccountId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" u2
    WHERE u2."stripeAccountId" = sp."stripeAccountId"
      AND u2."id" <> u."id"
  );

UPDATE "User" u
SET "stripeAccountId" = ap."stripeAccountId"
FROM "AffiliateProfile" ap
WHERE ap."userId" = u."id"
  AND u."stripeAccountId" IS NULL
  AND ap."stripeAccountId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" u2
    WHERE u2."stripeAccountId" = ap."stripeAccountId"
      AND u2."id" <> u."id"
  );

DROP INDEX IF EXISTS "SupplierProfile_stripeAccountId_key";
DROP INDEX IF EXISTS "AffiliateProfile_stripeAccountId_key";

ALTER TABLE "SupplierProfile" DROP COLUMN IF EXISTS "stripeAccountId";
ALTER TABLE "AffiliateProfile" DROP COLUMN IF EXISTS "stripeAccountId";
