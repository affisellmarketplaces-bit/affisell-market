/**
 * Home collections — pure, client-safe. Turns ONE ranked list of buyer-visible listings into:
 *  - category mosaics (4 real products of a root category), and
 *  - budget collections ("under €20 / €50 / €100").
 * Nothing here is invented: every tile is a real listing, ranked by the order it is given (sales, then clicks).
 * A collection with fewer than MIN_TILES distinct displayable products is dropped, never padded.
 */

export const COLLECTION_TILES = 4
export const MAX_CATEGORY_COLLECTIONS = 6
export const PRICE_BANDS_EUR = [20, 50, 100] as const

export type CollectionListing = {
  id: string
  productId: string
  title: string
  image: string
  href: string
  priceCents: number
  categoryId: string | null
}

export type CollectionTile = { id: string; title: string; image: string; href: string; priceCents: number }

export type HomeCollection =
  | { kind: "category"; key: string; categoryId: string; title: string; tiles: CollectionTile[] }
  | { kind: "price"; key: string; maxEur: number; tiles: CollectionTile[] }

export type RootCategory = { id: string; name: string; subcategoryIds: string[] }

const toTile = (l: CollectionListing): CollectionTile => ({
  id: l.id,
  title: l.title,
  image: l.image,
  href: l.href,
  priceCents: l.priceCents,
})

/** First `n` listings with distinct products and a displayable image, keeping the given (ranked) order. */
function pickDistinct(listings: readonly CollectionListing[], n: number): CollectionListing[] {
  const seen = new Set<string>()
  const out: CollectionListing[] = []
  for (const l of listings) {
    if (!l.image.trim() || !l.title.trim() || seen.has(l.productId)) continue
    seen.add(l.productId)
    out.push(l)
    if (out.length === n) break
  }
  return out
}

export function buildHomeCollections(input: {
  listings: readonly CollectionListing[]
  roots: readonly RootCategory[]
  maxCategoryCards?: number
  /** Tiles kept per card (default 4). Use a larger value to over-pick candidates before images are known. */
  tileCount?: number
  /** A card needs at least this many distinct products (default 4). */
  minTiles?: number
}): HomeCollection[] {
  const { listings, roots } = input
  const maxCards = input.maxCategoryCards ?? MAX_CATEGORY_COLLECTIONS
  const tileCount = input.tileCount ?? COLLECTION_TILES
  const minTiles = input.minTiles ?? COLLECTION_TILES

  const rootOf = new Map<string, RootCategory>()
  for (const r of roots) {
    rootOf.set(r.id, r)
    for (const s of r.subcategoryIds) rootOf.set(s, r)
  }

  // Category mosaics — keep the roots' own order (already curated), only those that can fill a whole card.
  const byRoot = new Map<string, CollectionListing[]>()
  for (const l of listings) {
    const root = l.categoryId ? rootOf.get(l.categoryId) : undefined
    if (!root) continue
    const bucket = byRoot.get(root.id) ?? []
    bucket.push(l)
    byRoot.set(root.id, bucket)
  }
  const categoryCards: HomeCollection[] = []
  for (const root of roots) {
    const tiles = pickDistinct(byRoot.get(root.id) ?? [], tileCount)
    if (tiles.length < minTiles) continue
    categoryCards.push({
      kind: "category",
      key: `cat-${root.id}`,
      categoryId: root.id,
      title: root.name,
      tiles: tiles.map(toTile),
    })
    if (categoryCards.length >= maxCards) break
  }

  // Budget collections — real listing prices, cheapest band first; a band identical to a smaller one is skipped.
  const priceCards: HomeCollection[] = []
  let previousIds = ""
  let previousMaxCents = 0
  for (const maxEur of PRICE_BANDS_EUR) {
    const within = listings.filter((l) => l.priceCents > 0 && l.priceCents <= maxEur * 100)
    // Prefer products ABOVE the previous band so "under €50" does not repeat "under €20"; cheaper ones only fill gaps.
    const ordered = [
      ...within.filter((l) => l.priceCents > previousMaxCents),
      ...within.filter((l) => l.priceCents <= previousMaxCents),
    ]
    previousMaxCents = maxEur * 100
    const tiles = pickDistinct(ordered, tileCount)
    if (tiles.length < minTiles) continue
    const ids = tiles.map((t) => t.id).join(",")
    if (ids === previousIds) continue
    previousIds = ids
    priceCards.push({ kind: "price", key: `price-${maxEur}`, maxEur, tiles: tiles.map(toTile) })
  }

  return [...categoryCards, ...priceCards]
}
