/** Client-safe parse of User.supplierMetrics JSON for public storefront. */
export type SupplierStorefrontTrustMetrics = {
  averageRating?: number
  disputeRatePct?: number
  shippedWithin48hPct?: number
}

export function parseSupplierStorefrontTrustMetrics(raw: unknown): SupplierStorefrontTrustMetrics {
  if (typeof raw !== "object" || raw === null) return {}
  const o = raw as Record<string, unknown>
  const averageRating =
    typeof o.averageRating === "number" && Number.isFinite(o.averageRating) ? o.averageRating : undefined
  const disputeRatePct =
    typeof o.disputeRatePct === "number" && Number.isFinite(o.disputeRatePct) ? o.disputeRatePct : undefined
  const shippedWithin48hPct =
    typeof o.shippedWithin48hPct === "number" && Number.isFinite(o.shippedWithin48hPct)
      ? o.shippedWithin48hPct
      : undefined
  return { averageRating, disputeRatePct, shippedWithin48hPct }
}
