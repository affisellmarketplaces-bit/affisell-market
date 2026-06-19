import "server-only"

import { listingDisplayTitle, listingPrimaryImageUrl } from "@/lib/affiliate-listing-display"
import type { AuctionArenaPayload, AuctionBidPublic, AuctionLotPublic, AuctionLotStatus } from "@/lib/auction-types"
import { anonymizeBidder, auctionHeatScore, minNextBidCents } from "@/lib/auction-math"
import { retireIneligibleAuctionLots } from "@/lib/auction-listing-lifecycle"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { buyerMarketplaceProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { primaryProductImage } from "@/lib/product-images"
import { prisma } from "@/lib/prisma"

const LIVE_TARGET = 8
const AUCTION_DURATION_MS = 48 * 3_600_000

function effectiveStatus(
  row: { status: string; startsAt: Date; endsAt: Date },
  now: Date
): AuctionLotStatus {
  if (row.status === "ENDED" || row.status === "CANCELLED") return "ENDED"
  if (now >= row.endsAt) return "ENDED"
  if (now < row.startsAt) return "SCHEDULED"
  const msLeft = row.endsAt.getTime() - now.getTime()
  if (msLeft <= 3_600_000) return "ENDING_SOON"
  return "LIVE"
}

async function closeExpiredAuctions(now: Date): Promise<void> {
  const expired = await prisma.auction.findMany({
    where: { status: { in: ["LIVE", "SCHEDULED"] }, endsAt: { lte: now } },
    select: { id: true },
    take: 32,
  })
  if (expired.length === 0) return

  for (const row of expired) {
    const top = await prisma.auctionBid.findFirst({
      where: { auctionId: row.id },
      orderBy: { amountCents: "desc" },
      select: { userId: true },
    })
    await prisma.auction.update({
      where: { id: row.id },
      data: {
        status: "ENDED",
        winnerUserId: top?.userId ?? null,
      },
    })
  }
}

/** Idempotent: keep the arena stocked with live lots from converting listings. */
async function ensureLiveAuctions(now: Date): Promise<void> {
  const liveCount = await prisma.auction.count({
    where: { status: "LIVE", endsAt: { gt: now } },
  })
  if (liveCount >= LIVE_TARGET) return

  const activeProductIds = await prisma.auction.findMany({
    where: { status: { in: ["LIVE", "SCHEDULED"] }, endsAt: { gt: now } },
    select: { productId: true },
  })
  const exclude = new Set(activeProductIds.map((r) => r.productId))

  const listings = await prisma.affiliateProduct.findMany({
    where: {
      ...buyerListedAffiliateProductWhere,
      auctionEligible: true,
      product: buyerMarketplaceProductWhere,
      ...(exclude.size > 0 ? { productId: { notIn: [...exclude] } } : {}),
    },
    orderBy: [{ conversions: "desc" }, { clicks: "desc" }, { createdAt: "desc" }],
    take: LIVE_TARGET - liveCount + 4,
    select: {
      id: true,
      sellingPriceCents: true,
      customTitle: true,
      customImages: true,
      product: {
        select: { id: true, name: true, images: true },
      },
      affiliate: {
        select: {
          store: { select: { slug: true, name: true } },
        },
      },
    },
  })

  let created = 0
  for (const row of listings) {
    if (liveCount + created >= LIVE_TARGET) break
    const p = row.product
    const store = row.affiliate.store
    if (!store?.slug) continue

    const imageUrl =
      listingPrimaryImageUrl(row.customImages, p.images) ||
      primaryProductImage(p.images) ||
      "/placeholder-product.jpg"
    const startPriceCents = Math.max(
      99,
      Math.floor(row.sellingPriceCents * 0.55)
    )

    await prisma.auction.create({
      data: {
        productId: p.id,
        listingId: row.id,
        title: listingDisplayTitle(row.customTitle, p.name),
        imageUrl,
        startPriceCents,
        reservePriceCents: Math.floor(row.sellingPriceCents * 0.85),
        currentBidCents: 0,
        bidCount: 0,
        startsAt: now,
        endsAt: new Date(now.getTime() + AUCTION_DURATION_MS),
        status: "LIVE",
      },
    })
    created += 1
    console.log("[auctions]", { productId: p.id, result: "seeded" })
  }
}

function serializeLot(
  row: {
    id: string
    productId: string
    listingId: string | null
    title: string
    imageUrl: string | null
    startPriceCents: number
    currentBidCents: number
    bidCount: number
    startsAt: Date
    endsAt: Date
    status: string
  },
  store: { slug: string; name: string } | null,
  leaderUserId: string | null,
  now: Date
): AuctionLotPublic {
  const status = effectiveStatus(row, now)
  const msLeft = Math.max(0, row.endsAt.getTime() - now.getTime())
  const current = Math.max(row.startPriceCents, row.currentBidCents)
  const listingId = row.listingId
  const href = listingId && store?.slug
    ? `/shops/${encodeURIComponent(store.slug)}/product/${listingId}`
    : "/shops/browse"

  return {
    id: row.id,
    productId: row.productId,
    listingId,
    title: row.title,
    imageUrl: row.imageUrl?.trim() || "/placeholder-product.jpg",
    storeSlug: store?.slug ?? null,
    storeName: store?.name ?? null,
    href,
    startPriceCents: row.startPriceCents,
    currentBidCents: current,
    bidCount: row.bidCount,
    minNextBidCents: minNextBidCents(row.startPriceCents, current),
    endsAt: row.endsAt.toISOString(),
    status,
    leaderLabel: leaderUserId ? anonymizeBidder(leaderUserId) : null,
    heatScore: auctionHeatScore(row.bidCount, msLeft),
  }
}

export async function loadAuctionArena(): Promise<AuctionArenaPayload> {
  const now = new Date()
  await closeExpiredAuctions(now)
  await retireIneligibleAuctionLots(now)
  await ensureLiveAuctions(now)

  const rows = await prisma.auction.findMany({
    where: { status: "LIVE", endsAt: { gt: now } },
    orderBy: [{ endsAt: "asc" }, { bidCount: "desc" }],
    take: 12,
    select: {
      id: true,
      productId: true,
      listingId: true,
      title: true,
      imageUrl: true,
      startPriceCents: true,
      currentBidCents: true,
      bidCount: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  })

  const liveRows = rows.filter((r) => effectiveStatus(r, now) !== "ENDED")

  const listingIds = liveRows.map((r) => r.listingId).filter(Boolean) as string[]
  const listings =
    listingIds.length > 0
      ? await prisma.affiliateProduct.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true,
            affiliate: { select: { store: { select: { slug: true, name: true } } } },
          },
        })
      : []
  const storeByListing = new Map(
    listings.map((l) => [l.id, l.affiliate.store] as const)
  )

  const auctionIds = liveRows.map((r) => r.id)
  const topBids =
    auctionIds.length > 0
      ? await prisma.auctionBid.findMany({
          where: { auctionId: { in: auctionIds } },
          orderBy: { amountCents: "desc" },
          distinct: ["auctionId"],
          select: { auctionId: true, userId: true },
        })
      : []
  const leaderByAuction = new Map(topBids.map((b) => [b.auctionId, b.userId]))

  const lots: AuctionLotPublic[] = liveRows.map((row) =>
    serializeLot(
      row,
      row.listingId ? storeByListing.get(row.listingId) ?? null : null,
      leaderByAuction.get(row.id) ?? null,
      now
    )
  )

  const recentBidRows = await prisma.auctionBid.findMany({
    orderBy: { createdAt: "desc" },
    take: 16,
    select: {
      id: true,
      auctionId: true,
      amountCents: true,
      userId: true,
      createdAt: true,
    },
  })

  const recentBids: AuctionBidPublic[] = recentBidRows.map((b) => ({
    id: b.id,
    auctionId: b.auctionId,
    amountCents: b.amountCents,
    bidderLabel: anonymizeBidder(b.userId),
    createdAt: b.createdAt.toISOString(),
  }))

  return {
    lots: lots.sort((a, b) => {
      if (a.status === "ENDING_SOON" && b.status !== "ENDING_SOON") return -1
      if (b.status === "ENDING_SOON" && a.status !== "ENDING_SOON") return 1
      return b.heatScore - a.heatScore
    }),
    recentBids,
    serverTime: now.toISOString(),
  }
}
