/**
 * Buyer-safe margin: only when wholesale (supplier) price is known.
 * Returns margin in cents, or null when it cannot be computed.
 */
export function calcMarginCents(
  price: number,
  supplierPrice: number | null | undefined
): number | null {
  if (supplierPrice == null || !Number.isFinite(supplierPrice) || supplierPrice <= 0) {
    return null
  }
  if (!Number.isFinite(price) || price <= 0) return null
  const margin = price - supplierPrice
  if (!Number.isFinite(margin) || margin <= 0) return null
  return Math.round(margin * 100)
}
