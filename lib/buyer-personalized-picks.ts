import "server-only"

import { cookies, headers } from "next/headers"

import {
  loadBuyerListingsByCategoryHints,
  loadBuyerListingsByListingIds,
  type BuyerListingCard,
} from "@/lib/buyer-discovery-data"
import {
  BUYER_BROWSE_SIGNALS_COOKIE,
  collectCategoryHints,
  parseBrowseSignalsCookie,
} from "@/lib/buyer-browse-signals-shared"
import { sortBuyerListingCardsByDeliveryCountryBoost } from "@/lib/buyer-listing-country-boost"
import type { BuyerPersonalizedPicksPayload } from "@/lib/buyer-personalization-shared"
import { loadHomeBestSellers7dCached } from "@/lib/public-home-cache"
import { prisma } from "@/lib/prisma"
import { resolveVisitorCountryIso2 } from "@/lib/visitor-country"

const MIN_RAIL_ITEMS = 4
const TARGET_ITEMS = 8

type SignalSeed = {
  productIds: string[]
  categoryLists: string[][]
  hasPersonalSignals: boolean
}

async function readBrowseCategoryNames(): Promise<string[]> {
  try {
    const jar = await cookies()
    return parseBrowseSignalsCookie(jar.get(BUYER_BROWSE_SIGNALS_COOKIE)?.value)
  } catch {
    return []
  }
}

async function readVisitorCountry(): Promise<string | null> {
  try {
    const requestHeaders = await headers()
    return resolveVisitorCountryIso2(requestHeaders)
  } catch {
    return null
  }
}

async function loadDeliveryCodesByProductId(
  productIds: string[]
): Promise<Map<string, string[]>> {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return new Map()

  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, deliveryCountryCodes: true },
  })

  return new Map(rows.map((row) => [row.id, row.deliveryCountryCodes ?? []]))
}

async function loadSignalSeed(args: {
  userId: string | null
  guestId: string | null
}): Promise<SignalSeed> {
  const productIds: string[] = []
  const categoryLists: string[][] = []
  let hasPersonalSignals = false

  const browseNames = await readBrowseCategoryNames()
  if (browseNames.length > 0) hasPersonalSignals = true

  if (args.userId) {
    const [wishlist, orders] = await Promise.all([
      prisma.wishlist.findMany({
        where: { userId: args.userId },
        orderBy: { updatedAt: "desc" },
        take: 12,
        select: {
          productId: true,
          product: { select: { categories: true } },
        },
      }),
      prisma.order.findMany({
        where: {
          buyerUserId: args.userId,
          status: { notIn: ["cancelled", "refunded", "failed", "pending_payment"] },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          productId: true,
          product: { select: { categories: true } },
        },
      }),
    ])

    if (wishlist.length > 0 || orders.length > 0) hasPersonalSignals = true

    for (const row of wishlist) {
      productIds.push(row.productId)
      categoryLists.push(row.product.categories ?? [])
    }
    for (const row of orders) {
      productIds.push(row.productId)
      categoryLists.push(row.product.categories ?? [])
    }
  }

  if (args.guestId) {
    const guestRows = await prisma.guestWishlist.findMany({
      where: { guestId: args.guestId },
      orderBy: { updatedAt: "desc" },
      take: 12,
      select: {
        productId: true,
        product: { select: { categories: true } },
      },
    })
    if (guestRows.length > 0) hasPersonalSignals = true
    for (const row of guestRows) {
      productIds.push(row.productId)
      categoryLists.push(row.product.categories ?? [])
    }
  }

  return {
    productIds: [...new Set(productIds)],
    categoryLists,
    hasPersonalSignals,
  }
}

const EMPTY_PICKS: BuyerPersonalizedPicksPayload = { items: [], personalized: false }

async function hasPersonalizationSignals(args: {
  userId: string | null
  guestId: string | null
}): Promise<boolean> {
  if (args.userId || args.guestId) return true
  const browseNames = await readBrowseCategoryNames()
  return browseNames.length > 0
}

/** Skip heavy DB for cold anonymous visitors — catalog paints first. */
export async function loadBuyerPersonalizedPicksFast(args: {
  userId: string | null
  guestId: string | null
}): Promise<BuyerPersonalizedPicksPayload> {
  if (!(await hasPersonalizationSignals(args))) {
    return EMPTY_PICKS
  }
  return loadBuyerPersonalizedPicks(args)
}

export async function loadBuyerPersonalizedPicks(args: {
  userId: string | null
  guestId: string | null
}): Promise<BuyerPersonalizedPicksPayload> {
  const [seed, browseNames, visitorCountry] = await Promise.all([
    loadSignalSeed(args),
    readBrowseCategoryNames(),
    readVisitorCountry(),
  ])
  const categoryHints = collectCategoryHints({
    productCategoryLists: seed.categoryLists,
    browseCategoryNames: browseNames,
  })

  const exclude = seed.productIds
  let items: BuyerListingCard[] = []

  if (categoryHints.length > 0) {
    items = await loadBuyerListingsByCategoryHints(
      categoryHints,
      exclude,
      TARGET_ITEMS,
      visitorCountry
    )
  }

  if (items.length < MIN_RAIL_ITEMS) {
    const ranked = await loadHomeBestSellers7dCached(TARGET_ITEMS * 2)
    const filler = await loadBuyerListingsByListingIds(
      ranked.map((row) => row.listingId),
      [...exclude, ...items.map((item) => item.productId)],
      TARGET_ITEMS - items.length,
      visitorCountry
    )
    items = [...items, ...filler].slice(0, TARGET_ITEMS)
  }

  if (visitorCountry && items.length > 1) {
    const deliveryCodesByProductId = await loadDeliveryCodesByProductId(
      items.map((item) => item.productId)
    )
    items = sortBuyerListingCardsByDeliveryCountryBoost(
      items,
      deliveryCodesByProductId,
      visitorCountry
    ).slice(0, TARGET_ITEMS)
  }

  const personalized = seed.hasPersonalSignals && items.length >= MIN_RAIL_ITEMS

  console.log("[buyer-personalized-picks]", {
    userId: args.userId ?? null,
    guestId: args.guestId ? "set" : null,
    visitorCountry,
    categoryHints: categoryHints.length,
    personalized,
    count: items.length,
  })

  return {
    items: items.slice(0, TARGET_ITEMS),
    personalized,
  }
}

export async function loadBuyerPersonalizedPicksSafe(args: {
  userId: string | null
  guestId: string | null
}): Promise<BuyerPersonalizedPicksPayload> {
  try {
    return await loadBuyerPersonalizedPicks(args)
  } catch (error) {
    console.error("[buyer-personalized-picks]", { error })
    return { items: [], personalized: false }
  }
}
