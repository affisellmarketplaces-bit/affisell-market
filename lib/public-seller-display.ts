/**
 * Labels shown to marketplace shoppers — never expose emails or login identifiers.
 */

function isUsablePublicName(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  if (value.includes("@")) return null
  return value
}

/** Partner / reseller storefront (curator) — not the legal seller of goods. */
export function publicPartnerSellerLabel(opts: {
  storeName: string | null | undefined
  affiliateDisplayName: string | null | undefined
}): string {
  const store = isUsablePublicName(opts.storeName)
  if (store) return store
  const name = isUsablePublicName(opts.affiliateDisplayName)
  if (name) return name
  return "Creator partner"
}

/**
 * Legal vendeur on the PDP / cart — supplier (fournisseur), per CGV.
 * Prefer KYC trade / legal entity name when available.
 */
export function publicSupplierVendorLabel(opts: {
  supplierName?: string | null
  tradeName?: string | null
  legalEntityName?: string | null
}): string {
  const trade = isUsablePublicName(opts.tradeName)
  if (trade) return trade
  const legal = isUsablePublicName(opts.legalEntityName)
  if (legal) return legal
  const name = isUsablePublicName(opts.supplierName)
  if (name) return name
  return "Verified supplier"
}

/** Public API / cards: derive a short store label without using email. */
export function publicStoreLabelFromAffiliateRow(row: {
  store: { name: string | null; slug: string } | null
  name: string | null
}): string {
  return publicPartnerSellerLabel({
    storeName: row.store?.name,
    affiliateDisplayName: row.name,
  })
}
