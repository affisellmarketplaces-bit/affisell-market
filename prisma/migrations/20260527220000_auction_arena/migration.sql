-- Affisell Auction Arena

CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "listingId" TEXT,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "startPriceCents" INTEGER NOT NULL,
    "reservePriceCents" INTEGER,
    "currentBidCents" INTEGER NOT NULL DEFAULT 0,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'LIVE',
    "winnerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuctionBid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionBid_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Auction_status_endsAt_idx" ON "Auction"("status", "endsAt");
CREATE INDEX "Auction_productId_idx" ON "Auction"("productId");
CREATE INDEX "Auction_listingId_idx" ON "Auction"("listingId");
CREATE INDEX "AuctionBid_auctionId_createdAt_idx" ON "AuctionBid"("auctionId", "createdAt" DESC);
CREATE INDEX "AuctionBid_userId_createdAt_idx" ON "AuctionBid"("userId", "createdAt" DESC);

ALTER TABLE "Auction" ADD CONSTRAINT "Auction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuctionBid" ADD CONSTRAINT "AuctionBid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
