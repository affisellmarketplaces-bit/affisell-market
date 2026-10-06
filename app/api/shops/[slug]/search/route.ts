import { loadAffiliateShopProductsForUserCached, loadAffiliateShopStoreCached } from "@/lib/shop-storefront-cache"
import {
  normalizeSearchText,
  SEARCH_MAX_QUERY_CHARS,
  SEARCH_MIN_CHARS,
  searchStoreProducts,
} from "@/lib/storefront/storefront-search"

export const runtime = "nodejs"

const CACHE = "public, s-maxage=30, stale-while-revalidate=120"

/**
 * Instant search inside ONE storefront — read-only, over the same cached product list the store page renders.
 * Nothing new is queried: the filter runs in memory, so an answer costs microseconds and a CDN may cache it.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, SEARCH_MAX_QUERY_CHARS)

  if (normalizeSearchText(q).length < SEARCH_MIN_CHARS) {
    return Response.json({ results: [] }, { headers: { "Cache-Control": CACHE } })
  }

  const store = await loadAffiliateShopStoreCached(slug)
  if (!store) return Response.json({ results: [] }, { status: 404 })

  const products = await loadAffiliateShopProductsForUserCached(store.userId, slug)
  const results = searchStoreProducts(
    products.map((p) => ({
      listingId: p.listingId,
      name: p.name,
      priceCents: p.priceCents,
      imageUrl: p.imageUrl,
      category: p.category?.name ?? null,
    })),
    q
  ).map((p) => ({ listingId: p.listingId, name: p.name, priceCents: p.priceCents, imageUrl: p.imageUrl }))

  return Response.json({ results }, { headers: { "Cache-Control": CACHE } })
}
