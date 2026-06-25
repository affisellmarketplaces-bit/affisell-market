/**
 * Labels shown to marketplace shoppers — never expose affiliate email or other login identifiers.
 */
export function publicPartnerSellerLabel(opts: {
  storeName: string | null | undefined
  affiliateDisplayName: string | null | undefined
}): string {
  const store = opts.storeName?.trim()
  if (store) return store
  const name = opts.affiliateDisplayName?.trim()
  if (name) return name
  return "Creator partner"
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
