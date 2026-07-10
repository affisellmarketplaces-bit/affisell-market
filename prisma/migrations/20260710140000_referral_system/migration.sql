-- Referral program: codes, balances, ledger, UGC claims

ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;
ALTER TABLE "User" ADD COLUMN "referralBonusBalanceCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "referralCode" = 'ref_' || substr(md5(random()::text || "id"), 1, 16)
WHERE "referralCode" IS NULL;

ALTER TABLE "User" ALTER COLUMN "referralCode" SET NOT NULL;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User"
ADD CONSTRAINT "User_referredById_fkey"
FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "referralBonusCents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ReferralBonusLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "entryType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralBonusLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralBonusLedger_idempotencyKey_key" ON "ReferralBonusLedger"("idempotencyKey");
CREATE INDEX "ReferralBonusLedger_userId_createdAt_idx" ON "ReferralBonusLedger"("userId", "createdAt");
CREATE INDEX "ReferralBonusLedger_orderId_idx" ON "ReferralBonusLedger"("orderId");

ALTER TABLE "ReferralBonusLedger"
ADD CONSTRAINT "ReferralBonusLedger_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralBonusLedger"
ADD CONSTRAINT "ReferralBonusLedger_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralUgcClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tweetUrl" TEXT NOT NULL,
    "screenshotUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "bonusCents" INTEGER NOT NULL DEFAULT 5000,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralUgcClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralUgcClaim_idempotencyKey_key" ON "ReferralUgcClaim"("idempotencyKey");
CREATE INDEX "ReferralUgcClaim_userId_createdAt_idx" ON "ReferralUgcClaim"("userId", "createdAt");
CREATE INDEX "ReferralUgcClaim_status_createdAt_idx" ON "ReferralUgcClaim"("status", "createdAt");

ALTER TABLE "ReferralUgcClaim"
ADD CONSTRAINT "ReferralUgcClaim_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
