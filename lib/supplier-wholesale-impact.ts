export const SUPPLIER_WHOLESALE_IMPACT_DAYS = 30

export type SupplierWholesaleImpactRow = {
  productId: string
  affiliateListingsLive: number
  marginReviewOpen: number
  unitsSold30d: number
  wholesaleGmvCents30d: number
}

export type SupplierWholesaleImpactSnapshot = {
  days: number
  rows: SupplierWholesaleImpactRow[]
  totals: {
    affiliateListingsLive: number
    marginReviewOpen: number
    productsWithOpenReviews: number
    unitsSold30d: number
    wholesaleGmvCents30d: number
  }
}

export type SupplierListingImpactInput = {
  productId: string
  isListed: boolean
  marginReviewNeeded: boolean
}

export type SupplierOrderVolumeInput = {
  productId: string
  quantity: number
  basePriceCents: number
}

export function buildSupplierWholesaleImpact(args: {
  listings: SupplierListingImpactInput[]
  orders: SupplierOrderVolumeInput[]
  days?: number
}): SupplierWholesaleImpactSnapshot {
  const days = args.days ?? SUPPLIER_WHOLESALE_IMPACT_DAYS
  const byProduct = new Map<string, SupplierWholesaleImpactRow>()

  for (const listing of args.listings) {
    const cur = byProduct.get(listing.productId) ?? {
      productId: listing.productId,
      affiliateListingsLive: 0,
      marginReviewOpen: 0,
      unitsSold30d: 0,
      wholesaleGmvCents30d: 0,
    }
    if (listing.isListed) cur.affiliateListingsLive += 1
    if (listing.marginReviewNeeded) cur.marginReviewOpen += 1
    byProduct.set(listing.productId, cur)
  }

  for (const order of args.orders) {
    const cur = byProduct.get(order.productId) ?? {
      productId: order.productId,
      affiliateListingsLive: 0,
      marginReviewOpen: 0,
      unitsSold30d: 0,
      wholesaleGmvCents30d: 0,
    }
    const qty = Math.max(1, order.quantity)
    cur.unitsSold30d += qty
    cur.wholesaleGmvCents30d += Math.max(0, order.basePriceCents) * qty
    byProduct.set(order.productId, cur)
  }

  const rows = [...byProduct.values()]
    .filter(
      (r) =>
        r.affiliateListingsLive > 0 ||
        r.marginReviewOpen > 0 ||
        r.unitsSold30d > 0
    )
    .sort(
      (a, b) =>
        b.marginReviewOpen - a.marginReviewOpen ||
        b.affiliateListingsLive - a.affiliateListingsLive ||
        b.wholesaleGmvCents30d - a.wholesaleGmvCents30d
    )

  const totals = rows.reduce(
    (t, r) => ({
      affiliateListingsLive: t.affiliateListingsLive + r.affiliateListingsLive,
      marginReviewOpen: t.marginReviewOpen + r.marginReviewOpen,
      productsWithOpenReviews:
        t.productsWithOpenReviews + (r.marginReviewOpen > 0 ? 1 : 0),
      unitsSold30d: t.unitsSold30d + r.unitsSold30d,
      wholesaleGmvCents30d: t.wholesaleGmvCents30d + r.wholesaleGmvCents30d,
    }),
    {
      affiliateListingsLive: 0,
      marginReviewOpen: 0,
      productsWithOpenReviews: 0,
      unitsSold30d: 0,
      wholesaleGmvCents30d: 0,
    }
  )

  return { days, rows, totals }
}

export function supplierWholesaleImpactByProductId(
  snapshot: SupplierWholesaleImpactSnapshot
): Record<string, SupplierWholesaleImpactRow> {
  return Object.fromEntries(snapshot.rows.map((r) => [r.productId, r]))
}
