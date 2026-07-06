import { listingDisplayTitle, listingGalleryUrls } from "@/lib/affiliate-listing-display"
import { normalizeListingSalesCount } from "@/lib/listing-sales-count"
import { shopListingPath } from "@/lib/affiliate-routes"

export type PdpCrossSellListingRow = {
  id: string
  sellingPriceCents: number
  conversions: number
  customTitle: string | null
  customImages: string[]
  product: { name: string; images: string[] }
  affiliate: { store: { slug: string } | null }
}

export type PdpCrossSellCard = {
  id: string
  href: string
  title: string
  image: string
  priceEur: number
  soldCount?: number
}

export type CoPurchaseScoreRow = {
  affiliateProductId: string
  affiliateId: string
  count: number
}

/** Rank co-purchase listing ids — same affiliate store boosted when tied. */
export function rankCoPurchaseListingIds(
  rows: CoPurchaseScoreRow[],
  args: { currentAffiliateId: string; limit?: number }
): string[] {
  const limit = args.limit ?? 6
  return [...rows]
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      const aBoost = a.affiliateId === args.currentAffiliateId ? 1 : 0
      const bBoost = b.affiliateId === args.currentAffiliateId ? 1 : 0
      if (bBoost !== aBoost) return bBoost - aBoost
      return a.affiliateProductId.localeCompare(b.affiliateProductId)
    })
    .slice(0, limit)
    .map((row) => row.affiliateProductId)
}

export function mergeUniqueListingIds(
  ...groups: Array<string[] | undefined>
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const group of groups) {
    if (!group) continue
    for (const id of group) {
      if (!id || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

export function mapPdpCrossSellListing(
  row: PdpCrossSellListingRow,
  args: { storeSlug?: string | null }
): PdpCrossSellCard {
  const rowStoreSlug = row.affiliate?.store?.slug?.trim()
  const storeSlug = args.storeSlug?.trim() || null
  const href = rowStoreSlug
    ? shopListingPath(rowStoreSlug, row.id)
    : storeSlug
      ? shopListingPath(storeSlug, row.id)
      : `/marketplace/${row.id}`

  return {
    id: row.id,
    href,
    title: listingDisplayTitle(row.customTitle, row.product.name),
    image:
      listingGalleryUrls(row.customImages, row.product.images ?? [])[0] ?? "/placeholder.png",
    priceEur: row.sellingPriceCents / 100,
    soldCount: normalizeListingSalesCount(row.conversions),
  }
}

export function mapPdpCrossSellListings(
  rows: PdpCrossSellListingRow[],
  args: { storeSlug?: string | null; limit?: number }
): PdpCrossSellCard[] {
  const limit = args.limit ?? 4
  return rows.slice(0, limit).map((row) => mapPdpCrossSellListing(row, args))
}
