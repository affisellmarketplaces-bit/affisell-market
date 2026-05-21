-- Trust Engine v2: extend Review, votes, replies, product ugcCount

CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'AI_FLAGGED', 'PUBLISHED', 'REJECTED');
CREATE TYPE "VoteType" AS ENUM ('HELPFUL', 'UNHELPFUL');

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ugcCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reviewReminderSentAt" TIMESTAMP(3);

ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "title" VARCHAR(120);
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "media" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "aiScore" DOUBLE PRECISION;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "moderationNote" TEXT;
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

ALTER TABLE "Review" ALTER COLUMN "author" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "sentiment" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Review_orderId_key" ON "Review"("orderId");
CREATE INDEX IF NOT EXISTS "Review_productId_status_publishedAt_idx" ON "Review"("productId", "status", "publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "Review_rating_status_idx" ON "Review"("rating", "status");

ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReviewVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VoteType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewVote_reviewId_userId_key" ON "ReviewVote"("reviewId", "userId");
CREATE INDEX IF NOT EXISTS "ReviewVote_reviewId_idx" ON "ReviewVote"("reviewId");

ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReviewReply" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewReply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReply_reviewId_key" ON "ReviewReply"("reviewId");

ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewReply" ADD CONSTRAINT "ReviewReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Review" SET "publishedAt" = COALESCE("date", "createdAt") WHERE "publishedAt" IS NULL;
