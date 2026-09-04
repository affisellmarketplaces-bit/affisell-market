import {
  BUYER_DISCOVER_CARD_META,
  type BuyerDiscoverCard,
  type BuyerDiscoverImage,
} from "@/lib/buyer-premium-home-content"
import type { HomeProductCard } from "@/lib/home-marketplace-cards"
import {
  loadHomeBestSellers7dSafe,
  loadHomeNewArrivalsSafe,
  loadHomeNewArrivalsCount7dSafe,
  loadHomeTopRatedSafe,
  loadHomeTrustedProductsSafe,
} from "@/lib/public-home-data"

const TILES_PER_CARD = 3
const FETCH_POOL = 12

function formatCompactCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString("en-US")
}

function productsToImages(products: HomeProductCard[]): BuyerDiscoverImage[] {
  return products.slice(0, TILES_PER_CARD).flatMap((p) => {
    const src = p.imageUrl?.trim()
    if (!src) return []
    return [
      {
        src,
        alt: p.name,
        href: `/marketplace/${encodeURIComponent(p.listingId)}`,
      },
    ]
  })
}

function metaById(id: BuyerDiscoverCard["id"]) {
  const meta = BUYER_DISCOVER_CARD_META.find((c) => c.id === id)
  if (!meta) throw new Error(`[buyer-discover] unknown card id: ${id}`)
  return meta
}

function buildCard(
  id: BuyerDiscoverCard["id"],
  subtitle: string,
  products: HomeProductCard[]
): BuyerDiscoverCard | null {
  const images = productsToImages(products)
  if (images.length === 0) return null
  const meta = metaById(id)
  return { ...meta, subtitle, images }
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

  const cards = [
    buildCard(
      "trending",
      sold7d > 0
        ? `Hot this week • +${formatCompactCount(sold7d)} sold`
        : "Hot this week • Best sellers",
      trending
    ),
    buildCard(
      "recommended",
      recommended.length > 0
        ? `Top rated • ${recommended[0]?.reviewCount ?? 0}+ reviews`
        : "Based on your interests • Personalized for you",
      recommended
    ),
    buildCard("trusted", "Vetted sellers • High rating 4.8+ • EU based", trusted),
    buildCard(
      "new",
      newCount7d > 0
        ? `This week • ${formatCompactCount(newCount7d)}+ new products`
        : "Fresh picks • Just added",
      newArrivals
    ),
  ].filter((c): c is BuyerDiscoverCard => c != null)

  console.log("[buyer-discover]", {
    cardCount: cards.length,
    tiles: cards.map((c) => ({ id: c.id, images: c.images.length })),
  })

  return cards
}
