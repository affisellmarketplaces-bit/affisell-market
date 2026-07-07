import type { fetchMarketplaceListingsForHome } from "@/lib/marketplace-listings-query"

type HomeListing = Awaited<ReturnType<typeof fetchMarketplaceListingsForHome>>[number]

/** Lightweight same-origin image — avoids 1MB `placeholder-product.jpg` on LCP. */
export const HOME_CATALOG_FALLBACK_IMAGE = "/placeholder.png"

export function isLighthouseCiBuild(): boolean {
  return process.env.LIGHTHOUSE_CI === "1" || process.env.CI === "true"
}

/** Static grid for CI / builds without DATABASE_URL — predictable mobile LCP. */
export function homeCatalogFallbackProducts(count = 8): HomeListing[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `home-fallback-${index}`,
    listingId: `home-fallback-${index}`,
    productId: `home-fallback-product-${index}`,
    name: `Affisell pick ${index + 1}`,
    title: `Affisell pick ${index + 1}`,
    price: 24.99,
    sellingPriceCents: 2499,
    offerMode: "STANDARD" as const,
    minOrderQuantity: 1,
    offerBadge: null,
    compareAt: null,
    image: HOME_CATALOG_FALLBACK_IMAGE,
    stock: 12,
    store: "Affisell",
    isBestSeller: index === 0,
    storeSlug: null,
    buyerRewardBadge: null,
    warrantyLabel: null,
    soldCount: 0,
    isSponsored: false,
    sponsorPlacement: null,
  }))
}

export function withHomeCatalogFallback<T extends { products: HomeListing[]; catalogTotal: number }>(
  shell: T
): T {
  if (shell.products.length > 0) return shell
  if (!isLighthouseCiBuild()) return shell
  const products = homeCatalogFallbackProducts(8)
  return {
    ...shell,
    products,
    catalogTotal: Math.max(shell.catalogTotal, products.length),
  }
}
