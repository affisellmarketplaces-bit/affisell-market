import {
  BUYER_DISCOVER_CARD_META,
  type BuyerDiscoverCard,
  type BuyerDiscoverImage,
} from "@/lib/buyer-premium-home-content"
import type { HomeProductCard } from "@/lib/home-marketplace-cards"
import { resolveBuyerCardImageHref } from "@/lib/listing-card-image-shared"
import {
  loadHomeBestSellers7dSafe,
  loadHomeNewArrivalsSafe,
  loadHomeNewArrivalsCount7dSafe,
  loadHomeTopRatedSafe,
  loadHomeTrustedProductsSafe,
} from "@/lib/public-home-data"

const TILES_PER_CARD = 3
/** Oversample — skip listings without a displayable thumb so Discover never ships empty tiles. */
const FETCH_POOL = 24

function formatCompactCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString("en-US")
}

/** Pure — exported for unit tests. Prefer proxy/CDN href via listing id. */
export function productsToImages(products: HomeProductCard[]): BuyerDiscoverImage[] {
  const out: BuyerDiscoverImage[] = []
  for (const p of products) {
    if (out.length >= TILES_PER_CARD) break
    const src = resolveBuyerCardImageHref(p.imageUrl, p.listingId)
    if (!src.trim()) continue
    out.push({
      src,
      alt: p.name,
      href: `/marketplace/${encodeURIComponent(p.listingId)}`,
    })
  }
  return out
}

function metaById(id: BuyerDiscoverCard["id"]) {
  const meta = BUYER_DISCOVER_CARD_META.find((c) => c.id === id)
  if (!meta) throw new Error(`[buyer-discover] unknown card id: ${id}`)
  return meta
}

function buildCard(
  id: BuyerDiscoverCard["id"],
  subtitleKey: string,
  subtitleValues: Record<string, string | number> | undefined,
  products: HomeProductCard[]
): BuyerDiscoverCard | null {
  const images = productsToImages(products)
  if (images.length === 0) return null
  const meta = metaById(id)
  return { ...meta, subtitleKey, subtitleValues, images }
}

export async function loadBuyerDiscoverCards(): Promise<BuyerDiscoverCard[]> {
  const [trending, recommended, trusted, newArrivals, newCount7d] = await Promise.all([
    loadHomeBestSellers7dSafe(FETCH_POOL),
    loadHomeTopRatedSafe(FETCH_POOL),
    loadHomeTrustedProductsSafe(FETCH_POOL),
    loadHomeNewArrivalsSafe(FETCH_POOL),
    loadHomeNewArrivalsCount7dSafe(),
  ])

  const sold7d = trending.reduce((sum, p) => sum + p.soldCount, 0)

  // Every claim below is computed from data: confirmed (paid, not cancelled/refunded) sales, real ratings, real counts.
  const cards = [
    sold7d > 0
      ? buildCard("trending", "trendingSold", { count: formatCompactCount(sold7d) }, trending)
      : buildCard("trending", "trendingDefault", undefined, trending),
    buildCard("recommended", "recommended", { count: recommended[0]?.reviewCount ?? 0 }, recommended),
    buildCard("trusted", "trusted", undefined, trusted),
    newCount7d > 0
      ? buildCard("new", "newCount", { count: formatCompactCount(newCount7d) }, newArrivals)
      : buildCard("new", "newDefault", undefined, newArrivals),
  ].filter((c): c is BuyerDiscoverCard => c != null)

  console.log("[buyer-discover]", {
    cardCount: cards.length,
    tiles: cards.map((c) => ({ id: c.id, images: c.images.length })),
  })

  return cards
}
