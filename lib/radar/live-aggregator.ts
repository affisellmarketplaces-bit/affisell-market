import { extractOrderShippingCountryIso2 } from "@/lib/checkout-country-rollout"
import { isPrismaMissingColumnError } from "@/lib/prisma-missing-column"
import { prisma } from "@/lib/prisma"
import { cityForCountryCode, pickDemoCity } from "@/lib/radar/live-cities"
import {
  classifyLiveEventsSource,
  GLOBE_LIVE_MAX_EVENTS,
  GLOBE_SUPPLIER_DEFAULT,
  type LiveEvent,
  type LiveEventType,
  type LiveEventsSource,
} from "@/lib/radar/live-types"

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const SPIKE_SALES_PER_HOUR = 3

const productLiveSelectBase = {
  id: true,
  name: true,
  images: true,
  categories: true,
  basePriceCents: true,
  sourceUrl: true,
  videoAdUrl: true,
  createdAt: true,
} as const

type ProductLiveRow = {
  id: string
  name: string
  images: unknown
  categories: unknown
  basePriceCents: number
  sourceUrl: string | null
  videoAdUrl: string | null
  createdAt?: Date
  supplierUrl?: string | null
  affiliateProducts?: Array<{ id: string; sellingPriceCents: number }>
}

function resolveSupplierUrl(p: {
  supplierUrl?: string | null
  sourceUrl?: string | null
}): string | null {
  return p.supplierUrl?.trim() || p.sourceUrl?.trim() || null
}

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function sparklineFromSeed(seed: number): number[] {
  const out: number[] = []
  let x = seed || 1
  for (let i = 0; i < 24; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0
    out.push(0.2 + (x % 80) / 100)
  }
  return out
}

function firstImage(images: unknown): string | null {
  if (!Array.isArray(images)) return null
  const u = images.find((x): x is string => typeof x === "string" && Boolean(x.trim()))
  return u?.trim() || null
}

function firstCategory(categories: unknown): string {
  if (!Array.isArray(categories)) return "Marketplace"
  const c = categories.find((x): x is string => typeof x === "string" && Boolean(x.trim()))
  return c?.trim() || "Marketplace"
}

function shippingCity(shippingAddress: unknown): string | null {
  if (!shippingAddress || typeof shippingAddress !== "object") return null
  const o = shippingAddress as Record<string, unknown>
  for (const key of ["city", "town", "locality"]) {
    const v = o[key]
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 48)
  }
  return null
}

function buildEvent(args: {
  id: string
  type: LiveEventType
  product: LiveEvent["product"]
  countryCode: string | null
  cityOverride?: string | null
  /** MEASURED sales per hour (spikes) — `null` when unknown. */
  salesPerHour: number | null
  /** Generated events only; `null` for every real event (never derive a growth from an id). */
  growth: number | null
  timestamp: Date
  videoUrl?: string | null
  /** True for an event generated to fill the globe (no real order / import / spike behind it). */
  synthetic?: boolean
  /** `order` only when the country was read from a real shipping address. */
  locationSource: "order" | "estimated"
}): LiveEvent {
  const cityMeta = cityForCountryCode(args.countryCode)
  const seed = hashSeed(args.id)
  return {
    id: args.id,
    type: args.type,
    product: args.product,
    location: {
      country: cityMeta.country,
      city: args.cityOverride?.trim() || cityMeta.city,
      lat: cityMeta.lat,
      lng: cityMeta.lng,
    },
    supplierLocation: { ...GLOBE_SUPPLIER_DEFAULT },
    salesPerHour: args.salesPerHour,
    growth: args.growth,
    timestamp: args.timestamp.toISOString(),
    videoUrl: args.videoUrl ?? null,
    // a 24 h curve exists only for a generated demo event; a real event has no hourly history here
    sparkline: args.synthetic === true ? sparklineFromSeed(seed) : null,
    synthetic: args.synthetic === true,
    locationSource: args.locationSource,
  }
}

async function loadTopSellerSnapshots(take: number) {
  return prisma.affiliateProduct.findMany({
    where: { isListed: true, product: { active: true, isDraft: false } },
    orderBy: { conversions: "desc" },
    take,
    select: {
      id: true,
      sellingPriceCents: true,
      conversions: true,
      product: {
        select: {
          id: true,
          name: true,
          images: true,
          categories: true,
          basePriceCents: true,
          sourceUrl: true,
          videoAdUrl: true,
        },
      },
    },
  })
}

function synthesizeDemoEvents(
  count: number,
  listings: Awaited<ReturnType<typeof loadTopSellerSnapshots>>
): LiveEvent[] {
  const events: LiveEvent[] = []
  const pool =
    listings.length > 0
      ? listings
      : Array.from({ length: 8 }, (_, i) => ({
          id: `demo_listing_${i}`,
          sellingPriceCents: 1990 + i * 500,
          conversions: 10 + i,
          product: {
            id: `demo_prod_${i}`,
            name: [
              "Meuble 6 tiroirs viral",
              "Lampe LED galaxy",
              "Support MagSafe Pro",
              "Blender USB-C pocket",
              "Casque bone-conduction",
              "Tapis yoga antidérapant",
              "Organiseur desk oak",
              "Gourde smart 1L",
            ][i]!,
            images: [] as unknown,
            categories: ["Home"] as unknown,
            basePriceCents: 1990,
            sourceUrl: "https://www.aliexpress.com/item/1005000000000.html",
            videoAdUrl: null as string | null,
          },
        }))

  for (let i = 0; i < count; i++) {
    const listing = pool[i % pool.length]!
    const city = pickDemoCity(hashSeed(`${listing.id}:${i}`))
    const types: LiveEventType[] = ["sale", "import", "spike"]
    const type = types[i % 3]!
    const growth = 80 + (hashSeed(`g:${listing.id}:${i}`) % 371)
    const salesPerHour = type === "spike" ? 8 + (i % 12) : 2 + (i % 6)
    const minsAgo = (hashSeed(`t:${i}`) % 50) + 1
    events.push(
      buildEvent({
        id: `demo_${listing.product.id}_${i}`,
        type,
        product: {
          id: listing.product.id,
          title: listing.product.name,
          image: firstImage(listing.product.images),
          price: (listing.sellingPriceCents || listing.product.basePriceCents) / 100,
          category: firstCategory(listing.product.categories),
          supplierUrl: listing.product.sourceUrl,
          affiliateProductId: listing.id.startsWith("demo_") ? null : listing.id,
        },
        countryCode: city.countryCode,
        cityOverride: city.city,
        salesPerHour,
        growth,
        timestamp: new Date(Date.now() - minsAgo * 60_000),
        videoUrl: listing.product.videoAdUrl,
        synthetic: true,
        locationSource: "estimated",
      })
    )
  }
  return events
}

async function loadRecentImports(since: Date): Promise<ProductLiveRow[]> {
  // Prefer sourceUrl only — Ghost supplierUrl may be absent until migrate deploys.
  try {
    return (await prisma.product.findMany({
      where: {
        createdAt: { gte: since },
        sourceUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        ...productLiveSelectBase,
        affiliateProducts: {
          where: { isListed: true },
          take: 1,
          select: { id: true, sellingPriceCents: true },
        },
      },
    })) as ProductLiveRow[]
  } catch (error: unknown) {
    if (isPrismaMissingColumnError(error, "sourceUrl")) return []
    throw error
  }
}

/**
 * Aggregate live Globe events from Affisell Orders + Product imports + velocity spikes.
 * Pads with generated demo events when volume is low — same shape, but each one is flagged `synthetic: true` and the payload
 * `source` says `mixed` / `demo`. Imports and spikes have no real location: their pin is flagged `locationSource: "estimated"`.
 * Real events carry only measured fields: `growth` and `sparkline` are `null` (they used to be hash(id) — fabricated numbers
 * next to real sales) and `salesPerHour` is set for spikes only. Generated events keep a made-up growth / curve, flagged `synthetic`.
 */
export async function aggregateRadarLiveEvents(): Promise<{
  events: LiveEvent[]
  /** Provenance of the returned events: `live` (all real), `mixed` (real + generated), `demo` (all generated). */
  source: LiveEventsSource
  countries: number
  /** Number of generated events in `events` (flagged `synthetic: true` one by one). */
  syntheticCount: number
}> {
  const since = new Date(Date.now() - DAY_MS)
  const hourAgo = new Date(Date.now() - HOUR_MS)
  const events: LiveEvent[] = []

  try {
    const [orders, imports, hourly, topListings] = await Promise.all([
      prisma.order.findMany({
        where: {
          createdAt: { gte: since },
          status: { notIn: ["refunded", "cancelled"] },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          createdAt: true,
          sellingPriceCents: true,
          shippingAddress: true,
          affiliateProductId: true,
          product: {
            select: {
              id: true,
              name: true,
              images: true,
              categories: true,
              sourceUrl: true,
              videoAdUrl: true,
            },
          },
        },
      }),
      loadRecentImports(since),
      prisma.order.groupBy({
        by: ["productId"],
        where: {
          createdAt: { gte: hourAgo },
          status: { notIn: ["refunded", "cancelled"] },
        },
        _count: { _all: true },
        orderBy: { _count: { productId: "desc" } },
        take: 15,
      }),
      loadTopSellerSnapshots(20),
    ])

    for (const order of orders) {
      const cc = extractOrderShippingCountryIso2(order.shippingAddress)
      const city = shippingCity(order.shippingAddress)
      events.push(
        buildEvent({
          id: `sale_${order.id}`,
          type: "sale",
          product: {
            id: order.product.id,
            title: order.product.name,
            image: firstImage(order.product.images),
            price: order.sellingPriceCents / 100,
            category: firstCategory(order.product.categories),
            supplierUrl: order.product.sourceUrl,
            affiliateProductId: order.affiliateProductId,
          },
          countryCode: cc,
          cityOverride: city,
          // one order is not "1 sale per hour", and a growth % cannot be derived from one order: unknown
          salesPerHour: null,
          growth: null,
          timestamp: order.createdAt,
          videoUrl: order.product.videoAdUrl,
          locationSource: cc ? "order" : "estimated",
        })
      )
    }

    for (const product of imports) {
      const listing = product.affiliateProducts?.[0]
      events.push(
        buildEvent({
          id: `import_${product.id}`,
          type: "import",
          product: {
            id: product.id,
            title: product.name,
            image: firstImage(product.images),
            price: (listing?.sellingPriceCents ?? product.basePriceCents) / 100,
            category: firstCategory(product.categories),
            supplierUrl: resolveSupplierUrl(product),
            affiliateProductId: listing?.id ?? null,
          },
          countryCode: pickDemoCity(hashSeed(product.id)).countryCode,
          salesPerHour: null,
          growth: null,
          timestamp: product.createdAt ?? new Date(),
          videoUrl: product.videoAdUrl,
          // imports carry no location: the pin is a hash-picked city, not where anything happened
          locationSource: "estimated",
        })
      )
    }

    const spikeProductIds = hourly
      .filter((row) => row._count._all >= SPIKE_SALES_PER_HOUR)
      .map((row) => row.productId)

    if (spikeProductIds.length > 0) {
      const spikeProducts = await prisma.product.findMany({
        where: { id: { in: spikeProductIds } },
        select: {
          id: true,
          name: true,
          images: true,
          categories: true,
          basePriceCents: true,
          sourceUrl: true,
          videoAdUrl: true,
          affiliateProducts: {
            where: { isListed: true },
            take: 1,
            orderBy: { conversions: "desc" },
            select: { id: true, sellingPriceCents: true },
          },
        },
      })
      const countById = new Map(hourly.map((r) => [r.productId, r._count._all]))
      for (const product of spikeProducts) {
        const sph = countById.get(product.id) ?? SPIKE_SALES_PER_HOUR
        const listing = product.affiliateProducts[0]
        events.push(
          buildEvent({
            id: `spike_${product.id}`,
            type: "spike",
            product: {
              id: product.id,
              title: product.name,
              image: firstImage(product.images),
              price: (listing?.sellingPriceCents ?? product.basePriceCents) / 100,
              category: firstCategory(product.categories),
              supplierUrl: product.sourceUrl,
              affiliateProductId: listing?.id ?? null,
            },
            countryCode: pickDemoCity(hashSeed(`spike:${product.id}`)).countryCode,
            // `sph` is the real count of orders of this product in the last hour; no growth % is invented from it
            salesPerHour: sph,
            growth: null,
            timestamp: new Date(),
            videoUrl: product.videoAdUrl,
            locationSource: "estimated",
          })
        )
      }
    }

    const seen = new Set<string>()
    const unique = events
      .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
      .filter((e) => {
        if (seen.has(e.id)) return false
        seen.add(e.id)
        return true
      })

    let final = unique.slice(0, GLOBE_LIVE_MAX_EVENTS)
    if (final.length < 12) {
      const pad = synthesizeDemoEvents(20, topListings).filter((d) => !seen.has(d.id))
      final = [...final, ...pad].slice(0, GLOBE_LIVE_MAX_EVENTS)
    }

    const countries = new Set(final.map((e) => e.location.country)).size
    // Provenance of what is ACTUALLY returned: "live" only when no generated event was added to fill the globe. It used to be
    // "live" as soon as 60 % of the events were real (the other 40 % being demo) and counted events dropped by the slice.
    const source: LiveEventsSource = classifyLiveEventsSource(final)
    const syntheticCount = final.filter((e) => e.synthetic === true).length

    console.log("[radar-live]", {
      result: "ok",
      realCount: final.length - syntheticCount,
      syntheticCount,
      total: final.length,
      source,
      countries,
    })

    return { events: final, source, countries, syntheticCount }
  } catch (e) {
    console.log("[radar-live]", {
      result: "fallback_demo",
      error: e instanceof Error ? e.message : String(e),
    })
    const demo = synthesizeDemoEvents(20, [])
    return {
      events: demo,
      source: "demo",
      countries: new Set(demo.map((e) => e.location.country)).size,
      syntheticCount: demo.length,
    }
  }
}
