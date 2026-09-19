import "server-only"

import { unstable_cache } from "next/cache"
import { Prisma } from "@prisma/client"

import { applyBattleFlashUnitCents } from "@/lib/pulse/battle-engine"
import { ensurePulseBattleSchema } from "@/lib/pulse/ensure-battle-schema"
import { listingDisplayTitle, listingPrimaryImageUrl, pickListingCardImageUrl } from "@/lib/affiliate-listing-display"
import { DEMO_LAB_EMAIL_BY_PERSONA } from "@/lib/demo/demo-accounts-shared"
import { resolveListingCardImageHref } from "@/lib/listing-card-image-shared"
import { buyerListedAffiliateProductWhere } from "@/lib/marketplace-buyer-product-filter"
import { prisma, withPrismaReconnect } from "@/lib/prisma"
import { parseStorefrontTheme } from "@/lib/storefront-theme-shared"

/* ───────────────────────────── Flash sales (live Pulse-battle winners) ───────────────────────────── */

export type FlashDeal = {
  key: string
  href: string
  title: string
  image: string
  flashPriceCents: number
  usualPriceCents: number
  /** % off the usual price — the same figure the product page shows. */
  pct: number
  /** DGCCRF reference: lowest price over the previous 30 days (null when not recorded). */
  referenceCents: number | null
  endsAt: string
}

/** Below this the offer is about to lapse — never advertise a flash the product page would refuse. */
const MIN_REMAINING_MS = 20_000

export async function loadFlashDealsUncached(): Promise<FlashDeal[]> {
  try {
    await ensurePulseBattleSchema()
    const now = Date.now()
    const battles = await withPrismaReconnect(() =>
      prisma.pulseBattle.findMany({
        where: { status: "ended", winnerId: { not: null }, flashEndsAt: { gt: new Date(now + MIN_REMAINING_MS) } },
        orderBy: { flashEndsAt: "asc" },
        take: 8,
        select: {
          id: true,
          winnerId: true,
          flashDiscount: true,
          flashEndsAt: true,
          flashDiscountSetBy: true,
          priceReferenceCents: true,
        },
      })
    )
    const winners = [...new Set(battles.flatMap((b) => (b.winnerId ? [b.winnerId] : [])))]
    if (winners.length === 0) return []

    const listings = await withPrismaReconnect(() =>
      prisma.affiliateProduct.findMany({
        where: { ...buyerListedAffiliateProductWhere, affiliate: { store: { isNot: null } }, productId: { in: winners } },
        select: {
          id: true,
          affiliateId: true,
          productId: true,
          sellingPriceCents: true,
          customImages: true,
          customTitle: true,
          product: { select: { name: true, images: true } },
        },
      })
    )

    const deals: FlashDeal[] = []
    for (const b of battles) {
      if (!b.winnerId || !b.flashEndsAt) continue
      const candidates = listings.filter((l) => l.productId === b.winnerId)
      // Prefer the listing of the reseller who set the flash %, otherwise the first buyer-visible one.
      const listing = candidates.find((l) => l.affiliateId === b.flashDiscountSetBy) ?? candidates[0]
      if (!listing) continue
      const pctRaw = b.flashDiscount > 0 && b.flashDiscount < 90 ? Math.round(b.flashDiscount) : 20
      const flashPriceCents = applyBattleFlashUnitCents(listing.sellingPriceCents, pctRaw)
      if (flashPriceCents >= listing.sellingPriceCents) continue // no real reduction → no "sale"
      // No real source image → no card (the proxy would otherwise return a generic placeholder).
      const rawImage =
        pickListingCardImageUrl(listing.customImages ?? [], listing.product.images ?? []) ??
        (listingPrimaryImageUrl(listing.customImages ?? [], listing.product.images ?? []) || null)
      if (!rawImage) continue
      const image = resolveListingCardImageHref(rawImage, listing.id)
      deals.push({
        key: b.id,
        href: `/marketplace/${encodeURIComponent(listing.id)}?battleId=${encodeURIComponent(b.id)}`,
        title: listingDisplayTitle(listing.customTitle, listing.product.name),
        image,
        flashPriceCents,
        usualPriceCents: listing.sellingPriceCents,
        pct: pctRaw,
        referenceCents: b.priceReferenceCents && b.priceReferenceCents > 0 ? b.priceReferenceCents : null,
        endsAt: b.flashEndsAt.toISOString(),
      })
    }
    return deals
  } catch (error) {
    console.error("[home-flash]", error instanceof Error ? error.message : String(error))
    return []
  }
}

/** Short cache (15s): the countdown is client-side, the list only needs to be roughly current. */
const loadFlashCached = unstable_cache(loadFlashDealsUncached, ["home-flash-v1"], { revalidate: 15, tags: ["home-flash"] })

export async function loadHomeFlashDealsSafe(timeoutMs = 2000): Promise<FlashDeal[]> {
  try {
    return await Promise.race([
      loadFlashCached(),
      new Promise<FlashDeal[]>((resolve) => setTimeout(() => resolve([]), timeoutMs)),
    ])
  } catch {
    return []
  }
}

/* ───────────────────────────── Shops to discover ───────────────────────────── */

export type HomeShop = {
  slug: string
  name: string
  logoUrl: string | null
  accent: string
  listedCount: number
  /** Confirmed units sold (paid, not cancelled/refunded). */
  soldUnits: number
  verified: boolean
}

const NON_SALE = ["cancelled", "canceled", "refunded", "pending", "failed", "expired"]

async function loadShops(limit: number): Promise<HomeShop[]> {
  const listed = await withPrismaReconnect(() =>
    prisma.affiliateProduct.groupBy({
      by: ["affiliateId"],
      where: { ...buyerListedAffiliateProductWhere, affiliate: { store: { isNot: null } } },
      _count: { _all: true },
    })
  )
  if (listed.length === 0) return []
  const ids = listed.map((l) => l.affiliateId)
  const listedById = new Map(listed.map((l) => [l.affiliateId, l._count._all]))

  const [stores, sales, legal] = await Promise.all([
    withPrismaReconnect(() =>
      prisma.store.findMany({
        where: { userId: { in: ids }, user: { role: "AFFILIATE", email: { notIn: Object.values(DEMO_LAB_EMAIL_BY_PERSONA) } } },
        select: { slug: true, name: true, logoUrl: true, aiAvatarUrl: true, userId: true, storefrontTheme: true },
      })
    ),
    withPrismaReconnect(() =>
      prisma.$queryRaw<{ affiliateId: string; units: number }[]>(Prisma.sql`
        SELECT "affiliateId", COALESCE(SUM("quantity"), 0)::int AS units
        FROM "Order"
        WHERE "affiliateId" IN (${Prisma.join(ids)})
          AND "paidAt" IS NOT NULL
          AND lower("status") NOT IN (${Prisma.join(NON_SALE)})
        GROUP BY "affiliateId"
      `)
    ),
    withPrismaReconnect(() =>
      prisma.merchantLegalProfile.findMany({
        where: { userId: { in: ids }, verificationStatus: "APPROVED" },
        select: { userId: true },
      })
    ),
  ])
  const soldById = new Map(sales.map((s) => [s.affiliateId, Number(s.units) || 0]))
  const verifiedIds = new Set(legal.map((l) => l.userId))

  return stores
    // A storefront whose "name" is a pasted URL or @handle is unfinished — never showcase it on the home.
    .filter((s) => s.name.trim().length >= 2 && !/^(https?:\/\/|www\.)|@/i.test(s.name.trim()))
    .map((s): HomeShop => ({
      slug: s.slug,
      name: s.name,
      logoUrl: s.logoUrl ?? s.aiAvatarUrl ?? null,
      accent: parseStorefrontTheme(s.storefrontTheme).accent ?? "#7c3aed",
      listedCount: listedById.get(s.userId) ?? 0,
      soldUnits: soldById.get(s.userId) ?? 0,
      verified: verifiedIds.has(s.userId),
    }))
    // Real signals only: confirmed sales first, then verified merchants, then catalog breadth.
    .sort((a, b) => b.soldUnits - a.soldUnits || Number(b.verified) - Number(a.verified) || b.listedCount - a.listedCount)
    .slice(0, limit)
}

const loadShopsCached = (limit: number) =>
  unstable_cache(() => loadShops(limit), ["home-shops-v2", String(limit)], { revalidate: 300, tags: ["home"] })()

export async function loadHomeShopsSafe(limit = 6, timeoutMs = 2500): Promise<HomeShop[]> {
  try {
    return await Promise.race([
      loadShopsCached(limit),
      new Promise<HomeShop[]>((resolve) => setTimeout(() => resolve([]), timeoutMs)),
    ])
  } catch (error) {
    console.error("[home-shops]", error instanceof Error ? error.message : String(error))
    return []
  }
}
