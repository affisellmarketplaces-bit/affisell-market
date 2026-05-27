import "server-only"

import { minNextBidCents } from "@/lib/auction-math"
import { prisma } from "@/lib/prisma"

export type PlaceAuctionBidResult =
  | {
      ok: true
      amountCents: number
      bidCount: number
    }
  | { ok: false; error: string; code: "ENDED" | "LOW_BID" | "NOT_FOUND" | "RATE" }

const RATE_WINDOW_MS = 2_000

export async function placeAuctionBid(
  userId: string,
  auctionId: string,
  amountCents: number
): Promise<PlaceAuctionBidResult> {
  const id = auctionId.trim()
  if (!id) return { ok: false, error: "Missing auction", code: "NOT_FOUND" }

  const now = new Date()

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      endsAt: true,
      startPriceCents: true,
      currentBidCents: true,
      bidCount: true,
    },
  })

  if (!auction) return { ok: false, error: "Auction not found", code: "NOT_FOUND" }
  if (auction.status === "ENDED" || auction.status === "CANCELLED" || now >= auction.endsAt) {
    return { ok: false, error: "Auction ended", code: "ENDED" }
  }

  const minBid = minNextBidCents(auction.startPriceCents, auction.currentBidCents)
  if (!Number.isFinite(amountCents) || amountCents < minBid) {
    return {
      ok: false,
      error: `Minimum bid is ${minBid} cents`,
      code: "LOW_BID",
    }
  }

  const recent = await prisma.auctionBid.findFirst({
    where: { auctionId: id, userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  })
  if (recent && now.getTime() - recent.createdAt.getTime() < RATE_WINDOW_MS) {
    return { ok: false, error: "Please wait before bidding again", code: "RATE" }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const fresh = await tx.auction.findUnique({
      where: { id },
      select: {
        status: true,
        endsAt: true,
        startPriceCents: true,
        currentBidCents: true,
        bidCount: true,
      },
    })
    if (!fresh || fresh.status === "ENDED" || now >= fresh.endsAt) {
      return null
    }
    const minFresh = minNextBidCents(fresh.startPriceCents, fresh.currentBidCents)
    if (amountCents < minFresh) return null

    await tx.auctionBid.create({
      data: { auctionId: id, userId, amountCents },
    })
    return tx.auction.update({
      where: { id },
      data: {
        currentBidCents: amountCents,
        bidCount: { increment: 1 },
      },
      select: { currentBidCents: true, bidCount: true },
    })
  })

  if (!updated) {
    return { ok: false, error: "Bid too low or auction closed", code: "LOW_BID" }
  }

  console.log("[auctions]", { auctionId: id, userId, amountCents, result: "bid" })
  return {
    ok: true,
    amountCents: updated.currentBidCents,
    bidCount: updated.bidCount,
  }
}
