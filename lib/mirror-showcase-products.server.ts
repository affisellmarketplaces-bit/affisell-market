import { shopListingPath } from "@/lib/affiliate-routes"
import { loadBuyerHomeProductsSafe } from "@/lib/buyer-discovery-data"
import { HOME_CATALOG_FALLBACK_IMAGE } from "@/lib/home-catalog-fallback"
import { resolveListingCardImageHref } from "@/lib/listing-card-image-shared"
import type { MirrorShowcaseProduct } from "@/lib/mirror-showcase-shared"

const DEFAULT_LIMIT = 16

function fallbackMirrorProducts(count = 12): MirrorShowcaseProduct[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `mirror-fallback-${index}`,
    title: `Affisell pick ${index + 1}`,
    imageUrl: HOME_CATALOG_FALLBACK_IMAGE,
    href: "/marketplace",
  }))
}

/** Curated floating products for Mirror Attract — no prices (discovery veil). */
export async function loadMirrorShowcaseProducts(
  limit = DEFAULT_LIMIT
): Promise<MirrorShowcaseProduct[]> {
  const cards = await loadBuyerHomeProductsSafe(limit)

  const products: MirrorShowcaseProduct[] = []
  for (const card of cards) {
    products.push({
      id: card.listingId,
      title: card.name,
      imageUrl: resolveListingCardImageHref(card.imageUrl, card.listingId),
      href: shopListingPath(card.storeSlug, card.listingId, card.customSlug),
    })
    if (products.length >= limit) break
  }

  if (products.length >= 4) {
    console.log("[mirror-showcase]", { result: "ok", count: products.length })
    return products
  }

  const fallback = fallbackMirrorProducts(limit)
  console.log("[mirror-showcase]", {
    result: "fallback",
    live: products.length,
    count: fallback.length,
  })
  return fallback
}
